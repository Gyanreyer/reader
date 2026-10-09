import { db } from "./db.js";
import { refreshFeeds } from "./refreshFeeds.js";
import { settings } from "./settings.js";
import { enqueueForHost, getHostKey } from "./utils/hostQueue.js";
import { parseRetryAfter } from "./utils/parseRetryAfter.js";
import {
  ORIGINAL_CACHE_CONTROL_HEADER,
  PERMANENT_REDIRECT_HEADER,
  proxiedFetch,
} from "./utils/proxiedFetch.js";

/**
 * @import { Article, Feed } from './db.js';
 */

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
          // An article can be in more than one feed, like a post that's also in an aggregator's feed. It stays with
          // the feed that found it first, so only that feed's details are kept; otherwise each Refresh would swap
          // in the details from whichever feed was fetched last.
          if (article.feedURL === latestArticleData.feedURL) {
            article.title = latestArticleData.title;
            article.publishedAt = latestArticleData.publishedAt;
            article.author = latestArticleData.author;
          }
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
 * Gets when an article counts as discovered: when we would have found it if we'd been checking its feed all along.
 * That's when it was published, but no earlier than our previous successful fetch of the feed (when it wasn't in the
 * feed yet), and never in the future. So a feed's back catalog on its first fetch, or a backlog after a long break,
 * spreads across the days it was published, while an article which shows up with an old publish date still surfaces
 * as new.
 *
 * @param {number} publishedAt
 * @param {number | null} previousFetchAt When we last successfully fetched the feed, or null if we never have
 * @returns {number}
 */
const getDiscoveredAt = (publishedAt, previousFetchAt) => {
  const now = Date.now();
  if (!(publishedAt > 0)) {
    // The publish date is missing or invalid
    return now;
  }
  return Math.min(Math.max(publishedAt, previousFetchAt ?? 0), now);
};

const ATOM_NAMESPACE = "http://www.w3.org/2005/Atom";
const DUBLIN_CORE_NAMESPACE = "http://purl.org/dc/elements/1.1/";

const authorListFormat = new Intl.ListFormat(undefined, {
  style: "long",
  type: "conjunction",
});

/**
 * @param {Element} parent
 * @param {string} localName
 * @param {string | null} namespaceURI
 * @returns {Element[]}
 */
const getChildElements = (parent, localName, namespaceURI) =>
  Array.from(parent.children).filter(
    (element) =>
      element.localName === localName && element.namespaceURI === namespaceURI
  );

/**
 * RSS <author> is officially an email address like "jo@x.com (Jo Smith)", so we keep the name in parentheses
 * and drop a bare email address.
 *
 * @param {string | null} rawAuthor
 * @returns {string | null}
 */
const getRSSAuthorName = (rawAuthor) => {
  const author = rawAuthor?.trim();
  if (!author) {
    return null;
  }

  const nameMatch = author.match(/^\S+@\S+\s*\((.+)\)$/);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  return /^\S+@\S+$/.test(author) ? null : author;
};

/**
 * Gets the names of the authors of an Atom <entry> or <feed>.
 *
 * @param {Element} element
 * @returns {Array<string | null | undefined>}
 */
const getAtomAuthorNames = (element) =>
  getChildElements(element, "author", ATOM_NAMESPACE).map(
    (author) =>
      getChildElements(author, "name", ATOM_NAMESPACE)[0]?.textContent
  );

/**
 * Gets the names of the authors of a JSON Feed item or feed, from `authors` or the older `author`.
 *
 * @param {Record<string, any>} itemOrFeed
 * @returns {Array<string | null | undefined>}
 */
const getJSONFeedAuthorNames = (itemOrFeed) => {
  if (Array.isArray(itemOrFeed.authors)) {
    return itemOrFeed.authors.map(
      /**
       * @param {any} author
       */
      (author) => author?.name
    );
  }
  return [itemOrFeed.author?.name];
};

/**
 * Joins author names into a single string like "Ana, Ben, and Cy".
 *
 * @param {Array<string | null | undefined>} rawNames
 * @returns {string | null}
 */
const formatAuthorNames = (rawNames) => {
  /**
   * @type {string[]}
   */
  const names = [];
  for (const rawName of rawNames) {
    const name = rawName?.trim();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names.length > 0 ? authorListFormat.format(names) : null;
};

/**
 * @param {{
 *  feedURL: string;
 *  rawURL?: string | null;
 *  rawTitle?: string | null;
 *  rawContent?: string | null;
 *  rawThumbnailURL?: string | null;
 *  rawPublishedAtTimestamp?: string | null;
 *  rawAuthorNames?: Array<string | null | undefined>;
 *  rawFeedAuthorNames?: Array<string | null | undefined>; // Used if the article has no authors of its own
 *  previousFetchAt?: number | null; // When we last successfully fetched the feed, or null if we never have
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
  rawAuthorNames = [],
  rawFeedAuthorNames = [],
  previousFetchAt = null,
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
    discoveredAt: getDiscoveredAt(publishedAt, previousFetchAt),
    author:
      formatAuthorNames(rawAuthorNames) ?? formatAuthorNames(rawFeedAuthorNames),
    thumbnail,
    read: 0,
  };
};

/**
 * @param {string} feedURL
 * @param {Record<string, any>} feedJSON
 * @param {number | null} previousFetchAt
 */
async function processJSONFeedResponse(feedURL, feedJSON, previousFetchAt) {
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

  const feedAuthorNames = getJSONFeedAuthorNames(feedJSON);

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
        rawAuthorNames: getJSONFeedAuthorNames(item),
        rawFeedAuthorNames: feedAuthorNames,
        previousFetchAt,
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
 * @param {number | null} previousFetchAt
 */
async function processRSSFeedResponse(feedURL, feedDocument, previousFetchAt) {
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
        rawAuthorNames: [
          ...getChildElements(item, "author", null).map((author) =>
            getRSSAuthorName(author.textContent)
          ),
          ...getChildElements(item, "creator", DUBLIN_CORE_NAMESPACE).map(
            (creator) => creator.textContent
          ),
        ],
        previousFetchAt,
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
 * @param {number | null} previousFetchAt
 */
async function processAtomFeedResponse(feedURL, feedDocument, previousFetchAt) {
  const feedTitle = feedDocument.querySelector("feed > title")?.textContent.trim();
  if (feedTitle) {
    await db.feeds.update(feedURL, { title: feedTitle });
  }

  /**
   * @type {Record<string, Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  const feedAuthorNames = getAtomAuthorNames(feedDocument.documentElement);

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
        rawAuthorNames: getAtomAuthorNames(entry),
        rawFeedAuthorNames: feedAuthorNames,
        previousFetchAt,
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

// Publishers' refresh hints can lengthen a feed's refresh interval up to this limit
const MAX_REFRESH_HINT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

const SYNDICATION_NAMESPACE = "http://purl.org/rss/1.0/modules/syndication/";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * @type {Record<string, number>}
 */
const SYNDICATION_UPDATE_PERIODS = {
  hourly: ONE_HOUR,
  daily: 24 * ONE_HOUR,
  weekly: 7 * 24 * ONE_HOUR,
  monthly: 30 * 24 * ONE_HOUR,
  yearly: 365 * 24 * ONE_HOUR,
};

/**
 * Gets how often an RSS/Atom feed says it should be fetched, from RSS <ttl> or
 * the syndication module's <sy:updatePeriod> and <sy:updateFrequency>.
 *
 * @param {Document} feedDocument
 * @returns {number | null} The suggested interval in milliseconds, or null if the feed doesn't suggest one
 */
function getFeedDocumentRefreshHint(feedDocument) {
  /**
   * @type {number[]}
   */
  const hints = [];

  const ttlMinutes = Number(
    feedDocument.querySelector("channel > ttl")?.textContent?.trim() || NaN
  );
  if (ttlMinutes > 0) {
    hints.push(ttlMinutes * 60 * 1000);
  }

  const updatePeriod = feedDocument
    .getElementsByTagNameNS(SYNDICATION_NAMESPACE, "updatePeriod")[0]
    ?.textContent?.trim()
    .toLowerCase();
  const updateFrequency = Number(
    feedDocument
      .getElementsByTagNameNS(SYNDICATION_NAMESPACE, "updateFrequency")[0]
      ?.textContent?.trim() || NaN
  );
  if (updatePeriod || updateFrequency) {
    // The spec defaults to updating once a day
    const period = SYNDICATION_UPDATE_PERIODS[updatePeriod || "daily"];
    const frequency = updateFrequency > 0 ? updateFrequency : 1;
    if (period) {
      hints.push(period / frequency);
    }
  }

  return hints.length > 0 ? Math.max(...hints) : null;
}

/**
 * Gets how long a feed's response says it can be cached for, from its Cache-Control or Expires headers.
 *
 * @param {Response} response
 * @returns {number | null} The suggested interval in milliseconds, or null if the response doesn't suggest one
 */
function getResponseRefreshHint(response) {
  const { headers } = response;

  // The proxy passes on the publisher's Cache-Control here, since its own Cache-Control is always no-store
  const cacheControl = headers.get(ORIGINAL_CACHE_CONTROL_HEADER);

  const maxAgeMatch = cacheControl?.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i);
  if (maxAgeMatch) {
    // max-age takes precedence over Expires
    return Number(maxAgeMatch[1]) * 1000;
  }

  const expires = Date.parse(headers.get("Expires") ?? "");
  if (!Number.isNaN(expires)) {
    const responseDate = Date.parse(headers.get("Date") ?? "");
    return Math.max(
      0,
      expires - (Number.isNaN(responseDate) ? Date.now() : responseDate)
    );
  }

  return null;
}

/**
 * Parses a feed's response and saves its articles.
 *
 * @param {string} feedURL
 * @param {string} feedText
 * @param {string | null} contentType
 * @param {number | null} previousFetchAt
 *
 * @returns {Promise<{
 *  newArticlesCount: number;
 *  refreshHint: number | null;
 * }>} The number of new articles that were added to the database, and how often the feed suggests it should be fetched
 */
async function processFeedText(feedURL, feedText, contentType, previousFetchAt) {
  /**
   * @type {Record<string, any> | null}
   */
  let feedJSON = null;

  if (
    contentType === "application/feed+json" ||
    contentType === "application/json"
  ) {
    feedJSON = JSON.parse(feedText);
  } else if (
    contentType !== "application/atom+xml" &&
    contentType !== "application/rss+xml" &&
    feedText.startsWith("{") &&
    feedText.endsWith("}")
  ) {
    // We've received an unrecognized content type, but the feed looks like JSON, so try parsing it as JSON
    try {
      feedJSON = JSON.parse(feedText);
    } catch {
      // Swallow JSON parsing errors
    }
  }

  if (feedJSON) {
    return {
      newArticlesCount: await processJSONFeedResponse(
        feedURL,
        feedJSON,
        previousFetchAt
      ),
      // JSON Feed has no way to suggest how often to fetch it
      refreshHint: null,
    };
  }

  const feedDocument = domParser.parseFromString(feedText, "application/xml");
  const refreshHint = getFeedDocumentRefreshHint(feedDocument);

  if (contentType === "application/atom+xml") {
    return {
      newArticlesCount: await processAtomFeedResponse(
        feedURL,
        feedDocument,
        previousFetchAt
      ),
      refreshHint,
    };
  } else if (contentType === "application/rss+xml") {
    return {
      newArticlesCount: await processRSSFeedResponse(
        feedURL,
        feedDocument,
        previousFetchAt
      ),
      refreshHint,
    };
  }

  // If we're at this point, we've received an unrecognized content type, so determine if it's an Atom or RSS feed
  const rootElement = feedDocument.documentElement;
  if (
    rootElement.tagName === "feed" &&
    rootElement.namespaceURI === "http://www.w3.org/2005/Atom"
  ) {
    return {
      newArticlesCount: await processAtomFeedResponse(
        feedURL,
        feedDocument,
        previousFetchAt
      ),
      refreshHint,
    };
  } else if (rootElement.tagName === "rss") {
    return {
      newArticlesCount: await processRSSFeedResponse(
        feedURL,
        feedDocument,
        previousFetchAt
      ),
      refreshHint,
    };
  } else {
    throw new Error(
      `Received unrecognized XML feed format for feed URL ${feedURL}`
    );
  }
}

/**
 * A feed is a multi-author feed if its stored articles credit more than one distinct author.
 * Only these feeds show authors on their articles.
 *
 * @param {string} feedURL
 * @returns {Promise<boolean>}
 */
async function getIsMultiAuthorFeed(feedURL) {
  /**
   * @type {Set<string>}
   */
  const authors = new Set();
  await db.articles
    .where("[feedURL+discoveredAt]")
    .between([feedURL, -Infinity], [feedURL, Infinity])
    .until(() => authors.size > 1)
    .each((article) => {
      if (article.author) {
        authors.add(article.author);
      }
    });
  return authors.size > 1;
}

// A feed is dead after this many consecutive 404 Not Found responses
const MAX_NOT_FOUND_COUNT = 5;

// Backoff after consecutive failures doubles each time, up to this limit
const MAX_BACKOFF_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 week


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
 * @param {Response | null} response The error response, or null if the feed couldn't be read or processed
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

  const previousFetchAt = feed.lastSuccessfulRefreshAt ?? null;
  const fetchStartedAt = Date.now();

  const headers = new Headers();
  if (feed.etag) {
    headers.set("If-None-Match", feed.etag);
  }
  if (feed.lastModified) {
    headers.set("If-Modified-Since", feed.lastModified);
  }

  // This only throws if we can't reach our own proxy, which returns an error response when it can't reach the publisher.
  // That's a problem with our own connection rather than the feed, so it doesn't count as a failure.
  const feedResponse = await proxiedFetch(feed.url, {
    method: "GET",
    headers,
  });

  try {
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
      lastSuccessfulRefreshAt: fetchStartedAt,
      failureCount: 0,
      notFoundCount: 0,
      notFoundSince: null,
      movedTo: feedResponse.headers.get(PERMANENT_REDIRECT_HEADER),
    };

    const responseRefreshHint = getResponseRefreshHint(feedResponse);

    // A 304 means the feed is unchanged, so there's nothing to process
    if (feedResponse.status === 304) {
      // 304 responses may not repeat the full response's headers, so keep the hint we already have unless they do
      if (responseRefreshHint !== null) {
        changes.refreshHint = responseRefreshHint;
      }
    } else {
      const processedFeed = await processFeedText(
        feed.url,
        await feedResponse.text(),
        feedResponse.headers.get("content-type"),
        previousFetchAt
      );
      newArticlesCount = processedFeed.newArticlesCount;
      changes.isMultiAuthor = await getIsMultiAuthorFeed(feed.url);

      const hints = [responseRefreshHint, processedFeed.refreshHint].filter(
        (hint) => hint !== null
      );
      changes.refreshHint = hints.length > 0 ? Math.max(...hints) : null;

      // Only save these once the articles are saved, so a failure to process the feed doesn't
      // leave us with conditional headers that would skip over the articles we missed
      changes.etag = feedResponse.headers.get("Etag");
      changes.lastModified = feedResponse.headers.get("Last-Modified");
    }

    const refreshHint =
      changes.refreshHint !== undefined ? changes.refreshHint : feed.refreshHint;
    // Publishers' hints can only lengthen the interval, never shorten it
    const feedRefreshInterval = Math.max(
      refreshInterval,
      Math.min(refreshHint ?? 0, MAX_REFRESH_HINT_INTERVAL)
    );
    changes.nextRefreshAt = Date.now() + feedRefreshInterval;

    await db.feeds.update(feed.url, changes);

    return newArticlesCount;
  } catch (e) {
    // Feeds we couldn't read or process count as failures too
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

const MAX_CONCURRENT_FEED_FETCHES = 6;

/**
 * Refreshes every feed.
 *
 * @param {object} options
 * @param {(progress: number, hasNewArticles: boolean)=>void} options.onProgress
 * @param {()=>void} options.onComplete Called when the Refresh finishes, even if it failed
 * @param {boolean} [options.shouldForceRefresh=false] If true, feeds are fetched even if they aren't due yet,
 *  unless we're backing off from them after a failure
 */
export async function refreshAllArticles({
  onProgress,
  onComplete,
  shouldForceRefresh = false,
}) {
  onProgress(0, false);

  try {
    await refreshFeeds();

    const feeds = await db.feeds.toArray();
    const feedCount = feeds.length;

    let refreshedFeedCount = 0;

    // Each host's feeds are fetched one at a time, so we never fetch more than one feed from a host at once
    const hostFeedQueues = Array.from(
      Map.groupBy(feeds, (feed) =>
        URL.canParse(feed.url) ? getHostKey(feed.url) : feed.url
      ).values()
    );

    const fetchNextHostFeeds = async () => {
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
              refreshArticlesForFeed(feed, shouldForceRefresh)
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
        {
          length: Math.min(MAX_CONCURRENT_FEED_FETCHES, hostFeedQueues.length),
        },
        fetchNextHostFeeds
      )
    );
  } catch (e) {
    console.error("Failed to refresh feeds:", e);
  } finally {
    window.dispatchEvent(new CustomEvent("reader:feeds-updated"));

    onComplete();
  }
}
