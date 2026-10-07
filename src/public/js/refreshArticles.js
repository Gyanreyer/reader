import { db } from "./db.js";
import { refreshFeeds } from "./refreshFeeds.js";
import { settings } from "./settings.js";
import { enqueueForHost, getHostKey } from "./utils/hostQueue.js";
import { parseRetryAfter } from "./utils/parseRetryAfter.js";
import { proxiedFetch } from "./utils/proxiedFetch.js";

/**
 * @import { Article, Feed } from './db.js';
 */

// Timestamp to use for all newly discovered articles from this refresh
const discoveredAt = Date.now();

const domParser = new DOMParser();

/**
 * @param {{
 *  [articleURL: string]: Article;
 * }} parsedArticles
 *
 * @returns {Promise<number>} The number of new articles that were added to the database
 */
async function updateSavedArticles(parsedArticles) {
  const allFoundArticleURLs = Object.keys(parsedArticles);

  const articleURLsToAdd = new Set(allFoundArticleURLs);

  await db.transaction("rw", db.articles, async () => {
    await db.articles
      .where("url")
      .anyOf(allFoundArticleURLs)
      .modify((article) => {
        // Delete all article data that we've already found in the database
        articleURLsToAdd.delete(article.url);
        const latestArticleData = parsedArticles[article.url];
        if (latestArticleData) {
          article.title = latestArticleData.title;
          article.publishedAt = latestArticleData.publishedAt;
          if (
            latestArticleData.thumbnail &&
            (article.thumbnail === null ||
              article.thumbnail === "NO_THUMBNAIL")
          ) {
            // Fill in thumbnails for articles we haven't fetched a thumbnail for yet
            article.thumbnail = latestArticleData.thumbnail;
          }
        }
      });

    await db.articles.bulkPut(
      Object.values(parsedArticles).filter((article) =>
        articleURLsToAdd.has(article.url)
      )
    );
  });

  return articleURLsToAdd.size;
}

const WHITE_SPACE_REGEX = /\s+/;

// Images in article content smaller than this are probably emoji, icons, or tracking pixels
const MIN_CONTENT_IMAGE_SIZE = 100;

/**
 * Finds the first image in an article's content which could be used as its thumbnail.
 *
 * @param {Document} contentDocument
 * @param {string} articleURL
 * @returns {{ url: string; alt: string; } | null}
 */
const getContentImage = (contentDocument, articleURL) => {
  for (const image of contentDocument.images) {
    const src = image.getAttribute("src")?.trim();
    if (!src || src.startsWith("data:") || !URL.canParse(src, articleURL)) {
      continue;
    }

    if (
      image.classList.contains("emoji") ||
      image.classList.contains("wp-smiley")
    ) {
      continue;
    }

    // Images with a missing or non-numeric width/height (NaN) could be any size, so we'll allow them
    const width = Number(image.getAttribute("width") || NaN);
    const height = Number(image.getAttribute("height") || NaN);
    if (width < MIN_CONTENT_IMAGE_SIZE || height < MIN_CONTENT_IMAGE_SIZE) {
      continue;
    }

    return {
      url: new URL(src, articleURL).toString(),
      alt: image.getAttribute("alt")?.trim() ?? "",
    };
  }

  return null;
};

/**
 * @param {{
 *  feedURL: string;
 *  rawURL?: string | null;
 *  rawTitle?: string | null;
 *  rawContent?: string | null;
 *  rawThumbnailURL?: string | null;
 *  rawPublishedAtTimestamp?: string | null;
 *  isFirstFetch?: boolean;
 * }} data
 *
 * @returns {Article}
 */
const getFormattedArticleData = ({
  feedURL,
  rawURL = null,
  rawTitle = null,
  rawContent = null,
  rawThumbnailURL = null,
  rawPublishedAtTimestamp = null,
  isFirstFetch = false,
}) => {
  let url = rawURL?.trim();

  if (!url || !URL.canParse(url, feedURL)) {
    throw new Error(`Received invalid article URL: ${url}`);
  }

  // Ensure the article URL is absolute
  url = new URL(url, feedURL).toString();

  /**
   * @type {string | null}
   */
  let title = null;
  /**
   * @type {{ url: string; alt: string; } | null}
   */
  let thumbnail = null;
  /**
   * @type {number}
   */
  let publishedAt = 0;

  /**
   * @type {number | null}
   */
  let wordCount = null;

  if (rawTitle) {
    try {
      // Titles may include HTML entities, so we need to parse them as HTML to get clean sanitized text content
      const parsedTitle = (
        domParser.parseFromString(rawTitle, "text/html").body.textContent ??
        rawTitle
      ).trim();
      title = parsedTitle;
    } catch (e) {
      title = rawTitle.trim();
      console.error(e);
    }
  }

  if (rawThumbnailURL && URL.canParse(rawThumbnailURL, url)) {
    thumbnail = {
      url: new URL(rawThumbnailURL, url).toString(),
      alt: "",
    };
  }

  if (rawContent) {
    const parsedContentDocument = domParser.parseFromString(
      rawContent,
      "text/html"
    );

    if (!thumbnail) {
      // Using an image from the feed's content saves us from fetching the article page to look for one
      thumbnail = getContentImage(parsedContentDocument, url);
    }
    const contentText = parsedContentDocument.body.textContent?.trim() ?? "";

    const words = contentText.split(WHITE_SPACE_REGEX);
    wordCount = words.length;

    if (!title) {
      // Grab the first 10 words of the content text to use as a placeholder title
      title = `${words.slice(0, 10).join(" ")}${words.length > 10 ? "..." : ""
        }`;
    }
  }

  if (rawPublishedAtTimestamp) {
    publishedAt = new Date(rawPublishedAtTimestamp.trim()).getTime();
  }

  return {
    feedURL,
    url,
    title,
    wordCount,
    publishedAt,
    discoveredAt: isFirstFetch ? (publishedAt || discoveredAt) : discoveredAt,
    thumbnail,
    read: 0,
  };
};

/**
 * @param {string} feedURL
 * @param {Record<string, any>} feedJSON
 * @param {boolean} isFirstFetch
 */
async function processJSONFeedResponse(feedURL, feedJSON, isFirstFetch) {
  const feedTitle = feedJSON.title?.trim();
  if (feedTitle) {
    await db.feeds.update(feedURL, { title: feedTitle });
  }

  const items = feedJSON.items;
  if (!Array.isArray(items)) {
    throw new Error(
      `Received JSON feed response with missing "items" array for feed URL ${feedURL}`
    );
  }

  /**
   * @type {Record<string, import("./db.js").Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  for (const item of items) {
    try {
      const article = getFormattedArticleData({
        feedURL,
        rawURL: item.url,
        rawPublishedAtTimestamp: item.date_published || item.date_modified,
        rawTitle: item.title,
        rawContent: item.content_html || item.content_text,
        rawThumbnailURL:
          item.image ||
          item.banner_image ||
          item.attachments?.find(
            /**
             * @param {{
             *   mime_type?: string;
             *   url?: string;
             * }} attachment
             */
            (attachment) => attachment.mime_type?.startsWith("image")
          )?.url,
        isFirstFetch,
      });
      parsedArticles[article.url] = article;
    } catch (e) {
      console.error(
        "Failed to process JSON feed article data for item:",
        JSON.stringify(item, null, 2),
        e
      );
    }
  }

  return updateSavedArticles(parsedArticles);
}

/**
 * We have to account for RSS 0.91, 0.92, and 2.0
 *
 * @param {string} feedURL
 * @param {Document} feedDocument
 * @param {boolean} isFirstFetch
 */
async function processRSSFeedResponse(feedURL, feedDocument, isFirstFetch) {
  const feedTitle = feedDocument.querySelector("channel > title")?.textContent.trim();
  if (feedTitle) {
    await db.feeds.update(feedURL, { title: feedTitle });
  }

  /**
   * @type {Record<string, Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  for (const item of feedDocument.getElementsByTagName("item")) {
    try {
      const article = getFormattedArticleData({
        feedURL,
        rawURL:
          item.querySelector("link")?.textContent ||
          // Attempt to recover from missing URLs by checking for a URL in a <guid> tag
          item.querySelector("guid")?.textContent,
        rawTitle: item.querySelector("title")?.textContent,
        rawContent:
          item.getElementsByTagName("content:encoded")?.[0]?.textContent ||
          item.querySelector("description")?.textContent,
        rawPublishedAtTimestamp:
          item.querySelector("pubDate")?.textContent ||
          item.getElementsByTagName("dc:date")?.[0]?.textContent,
        rawThumbnailURL:
          item
            .getElementsByTagName("media:thumbnail")?.[0]
            ?.getAttribute("url") ||
          item.querySelector("enclosure[type^=image]")?.getAttribute("url"),
        isFirstFetch,
      });

      parsedArticles[article.url] = article;
    } catch (e) {
      console.error(
        "Failed to process RSS feed article data for item:",
        item.outerHTML,
        e
      );
    }
  }

  return updateSavedArticles(parsedArticles);
}

/**
 * @param {string} feedURL
 * @param {Document} feedDocument
 * @param {boolean} isFirstFetch
 */
async function processAtomFeedResponse(feedURL, feedDocument, isFirstFetch) {
  const feedTitle = feedDocument.querySelector("feed > title")?.textContent.trim();
  if (feedTitle) {
    await db.feeds.update(feedURL, { title: feedTitle });
  }

  /**
   * @type {Record<string, Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  for (const entry of feedDocument.getElementsByTagName("entry")) {
    try {
      const article = getFormattedArticleData({
        feedURL,
        rawURL:
          entry.querySelector("link")?.getAttribute("href") ||
          // Try to recover from a missing link by checking for a URL in an <id>/<guid> tag;
          // these are usually also the article URL
          (entry.querySelector("id") || entry.querySelector("guid"))
            ?.textContent,
        rawTitle: entry.querySelector("title")?.textContent,
        rawContent: entry.querySelector("content")?.textContent,
        rawPublishedAtTimestamp:
          entry.querySelector("published")?.textContent ||
          entry.querySelector("updated")?.textContent,
        rawThumbnailURL: entry
          .getElementsByTagName("media:thumbnail")?.[0]
          ?.getAttribute("url"),
        isFirstFetch,
      });
      parsedArticles[article.url] = article;
    } catch (e) {
      console.error(
        "Failed to process Atom feed article data for entry:",
        entry.outerHTML,
        e
      );
    }
  }

  return updateSavedArticles(parsedArticles);
}

/**
 * Parses a feed's response and saves its articles.
 *
 * @param {string} feedURL
 * @param {string} feedText
 * @param {string | null} contentType
 * @param {boolean} isFirstFetch
 *
 * @returns {Promise<number>} The number of new articles that were added to the database
 */
async function processFeedText(feedURL, feedText, contentType, isFirstFetch) {
  switch (contentType) {
    case "application/atom+xml":
      return processAtomFeedResponse(
        feedURL,
        domParser.parseFromString(feedText, "application/xml"),
        isFirstFetch
      );
    case "application/rss+xml":
      return processRSSFeedResponse(
        feedURL,
        domParser.parseFromString(feedText, "application/xml"),
        isFirstFetch
      );
    case "application/feed+json":
    case "application/json":
      return processJSONFeedResponse(feedURL, JSON.parse(feedText), isFirstFetch);
  }

  // If we're at this point, we've received an unrecognized content type. Let's see if we can figure it out.

  // If the feed looks like JSON, try parsing it as JSON
  if (feedText.startsWith("{") && feedText.endsWith("}")) {
    let feedJSON;
    try {
      feedJSON = JSON.parse(feedText);
    } catch {
      // Swallow JSON parsing errors
    }

    if (feedJSON) {
      return processJSONFeedResponse(feedURL, feedJSON, isFirstFetch);
    }
  }

  // Attempt to parse the feed as XML and determine if it's an Atom or RSS feed
  const feedDocument = domParser.parseFromString(feedText, "application/xml");
  const rootElement = feedDocument.documentElement;
  if (
    rootElement.tagName === "feed" &&
    rootElement.namespaceURI === "http://www.w3.org/2005/Atom"
  ) {
    return processAtomFeedResponse(feedURL, feedDocument, isFirstFetch);
  } else if (rootElement.tagName === "rss") {
    return processRSSFeedResponse(feedURL, feedDocument, isFirstFetch);
  } else {
    throw new Error(
      `Received unrecognized XML feed format for feed URL ${feedURL}`
    );
  }
}


// A feed is dead after this many consecutive 404 Not Found responses
const MAX_NOT_FOUND_COUNT = 5;

// Backoff after consecutive failures doubles each time, up to this limit
const MAX_BACKOFF_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 week

// The proxy sets this header when the feed URL permanently redirects to a new URL
const PERMANENT_REDIRECT_HEADER = "X-Proxy-Permanent-Redirect";

/**
 * Thrown when a feed's response has an error status.
 */
class FeedResponseError extends Error {
  /**
   * @param {string} feedURL
   * @param {Response} response
   */
  constructor(feedURL, response) {
    super(
      `Unable to refresh feed articles: received ${response.status} ${response.statusText} response from feed URL ${feedURL}`
    );
    this.response = response;
  }
}

/**
 * @param {number} timestamp
 * @returns {string} The local date in YYYY-MM-DD format
 */
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

/**
 * Gets the changes to save on a feed after a failed fetch, so we back off from fetching it,
 * or stop fetching it entirely if it's gone.
 *
 * @param {Feed} feed
 * @param {Response | null} response The error response, or null if the fetch failed without one
 * @param {number} refreshInterval
 * @returns {Partial<Feed>}
 */
function getFeedFailureChanges(feed, response, refreshInterval) {
  const now = Date.now();
  const failureCount = (feed.failureCount ?? 0) + 1;

  /**
   * @type {Partial<Feed>}
   */
  const changes = {
    lastRefreshedAt: now,
    failureCount,
    notFoundCount: 0,
    notFoundSince: null,
  };

  if (response?.status === 410) {
    changes.deadReason = `Publisher returned 410 Gone on ${formatDate(now)}`;
  } else if (response?.status === 404) {
    changes.notFoundCount = (feed.notFoundCount ?? 0) + 1;
    changes.notFoundSince = feed.notFoundSince ?? now;
    if (changes.notFoundCount >= MAX_NOT_FOUND_COUNT) {
      changes.deadReason = `404 Not Found on ${
        changes.notFoundCount
      } consecutive fetches since ${formatDate(changes.notFoundSince)}`;
    }
  }

  // Wait twice as long after each consecutive failure
  let nextRefreshAt =
    now +
    Math.min(refreshInterval * 2 ** (failureCount - 1), MAX_BACKOFF_INTERVAL);

  if (response?.status === 429 || response?.status === 503) {
    // The publisher may have told us how long to wait
    const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
    if (retryAfter) {
      nextRefreshAt = Math.max(nextRefreshAt, retryAfter);
    }
  }

  changes.nextRefreshAt = nextRefreshAt;

  return changes;
}

/**
 * @param {Feed} feed
 * @param {boolean} [shouldForceRefresh=false] If true, the feed will be refreshed regardless of the last refresh time,
 *  unless we're backing off from it after a failure

 * @returns {Promise<number>} The number of new articles that were added to the database
 */
export async function refreshArticlesForFeed(feed, shouldForceRefresh = false) {
  if (feed.deadReason) {
    // Dead feeds are never fetched again
    return 0;
  }

  const refreshInterval = await settings.get("articleRefreshInterval");

  // Feeds fetched before we stored nextRefreshAt are due one refresh interval after their last refresh
  const nextRefreshAt =
    feed.nextRefreshAt ?? (feed.lastRefreshedAt ?? 0) + refreshInterval;
  const isBackingOff = (feed.failureCount ?? 0) > 0;
  if (Date.now() < nextRefreshAt && (!shouldForceRefresh || isBackingOff)) {
    return 0;
  }

  // If we've never stored any articles from this feed, it's new (or has only ever failed), so we'll treat
  // its articles as discovered when they were published rather than letting its whole back catalog appear as new
  const isFirstFetch =
    (await db.articles.where("feedURL").equals(feed.url).limit(1).count()) ===
    0;

  const headers = new Headers({
    "If-None-Match": feed.etag ?? "",
    "If-Modified-Since": feed.lastModified ?? "",
  });

  try {
    const feedResponse = await proxiedFetch(feed.url, {
      method: "GET",
      headers,
    });

    if (!feedResponse.ok && feedResponse.status !== 304) {
      feedResponse.body?.cancel();
      throw new FeedResponseError(feed.url, feedResponse);
    }

    let newArticlesCount = 0;

    /**
     * @type {Partial<Feed>}
     */
    const changes = {
      lastRefreshedAt: Date.now(),
      nextRefreshAt: Date.now() + refreshInterval,
      failureCount: 0,
      notFoundCount: 0,
      notFoundSince: null,
      movedTo: feedResponse.headers.get(PERMANENT_REDIRECT_HEADER),
    };

    // A 304 means the feed is unchanged, so there's nothing to process
    if (feedResponse.status !== 304) {
      newArticlesCount = await processFeedText(
        feed.url,
        await feedResponse.text(),
        feedResponse.headers.get("content-type"),
        isFirstFetch
      );

      // Only save these once the articles are saved, so a failure to process the feed doesn't
      // leave us with conditional headers that would skip over the articles we missed
      changes.etag = feedResponse.headers.get("Etag");
      changes.lastModified = feedResponse.headers.get("Last-Modified");
    }

    await db.feeds.update(feed.url, changes);

    return newArticlesCount;
  } catch (e) {
    // Network errors and unparseable feeds count as failures too
    await db.feeds.update(
      feed.url,
      getFeedFailureChanges(
        feed,
        e instanceof FeedResponseError ? e.response : null,
        refreshInterval
      )
    );
    throw e;
  }
}

const MAX_CONCURRENT_FEED_REFRESHES = 6;

/**
 * @param {object} callbacks
 * @param {(progress: number, hasNewArticles: boolean)=>void} callbacks.onProgress
 * @param {()=>void} callbacks.onComplete
 */
export async function refreshAllArticles({ onProgress, onComplete }) {
  onProgress(0, false);

  await refreshFeeds();

  const feeds = await db.feeds.toArray();
  const feedCount = feeds.length;

  let refreshedFeedCount = 0;

  // Each host's feeds are refreshed one at a time, so we never fetch more than one feed from a host at once
  const hostFeedQueues = Array.from(
    Map.groupBy(feeds, (feed) =>
      URL.canParse(feed.url) ? getHostKey(feed.url) : feed.url
    ).values()
  );

  const refreshNextHostFeeds = async () => {
    /**
     * @type {Feed[] | undefined}
     */
    let hostFeeds;
    while ((hostFeeds = hostFeedQueues.shift())) {
      for (const feed of hostFeeds) {
        let newArticlesCount = 0;
        try {
          // Also queue with this host's article page fetches, so we don't fetch a feed and an article at the same time
          newArticlesCount = await enqueueForHost(feed.url, () =>
            refreshArticlesForFeed(feed)
          );
        } catch (e) {
          console.error(`Failed to refresh articles for feed ${feed.url}:`, e);
        }
        onProgress(++refreshedFeedCount / feedCount, newArticlesCount > 0);
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_FEED_REFRESHES, hostFeedQueues.length) },
      refreshNextHostFeeds
    )
  );

  window.dispatchEvent(new CustomEvent("reader:feeds-updated"));

  onComplete();
}
