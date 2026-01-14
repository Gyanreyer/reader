import { db } from "./db.js";
import { refreshFeeds } from "./refreshFeeds.js";
import { settings } from "./settings.js";
import { proxiedFetch } from "./utils/proxiedFetch.js";

/**
 * @import { Article } from './db.js';
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

/**
 * @param {{
 *  feedURL: string;
 *  rawURL?: string | null;
 *  rawTitle?: string | null;
 *  rawContent?: string | null;
 *  rawThumbnailURL?: string | null;
 *  rawPublishedAtTimestamp?: string | null;
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
   * @type {string | null}
   */
  let thumbnailURL = null;
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
    thumbnailURL = new URL(rawThumbnailURL, url).toString();
  }

  if (rawContent) {
    const parsedContentDocument = domParser.parseFromString(
      rawContent,
      "text/html"
    );
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
    discoveredAt,
    thumbnail: thumbnailURL
      ? {
        url: thumbnailURL,
        alt: "",
      }
      : null,
    read: 0,
  };
};

/**
 * @param {string} feedURL
 * @param {Record<string, any>} feedJSON
 */
async function processJSONFeedResponse(feedURL, feedJSON) {
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
 */
async function processRSSFeedResponse(feedURL, feedDocument) {
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
 */
async function processAtomFeedResponse(feedURL, feedDocument) {
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
 * @param {import("./db.js").Feed} feed
 * @param {boolean} [shouldForceRefresh=false] If true, the feed will be refreshed regardless of the last refresh time

 * @returns {Promise<number>} The number of new articles that were added to the database
 */
export async function refreshArticlesForFeed(feed, shouldForceRefresh = false) {
  if (!shouldForceRefresh) {
    const refreshInterval = await settings.get("articleRefreshInterval");
    const lastRefreshedAt = feed.lastRefreshedAt ?? 0;
    // If less time has elapsed since last refresh than the refresh interval, don't refresh
    if (Date.now() - lastRefreshedAt <= refreshInterval) {
      return 0;
    }
  }

  const headers = new Headers({
    "If-None-Match": feed.etag ?? "",
    "If-Modified-Since": feed.lastModified ?? "",
  });

  const feedResponse = await proxiedFetch(feed.url, {
    method: "GET",
    headers,
  });

  if (feedResponse.status === 304) {
    // The feed is unchanged, no need to update the database
    db.feeds.update(feed.url, {
      lastRefreshedAt: Date.now(),
    });
    return 0;
  }

  if (!feedResponse.ok) {
    db.feeds.update(feed.url, {
      lastRefreshedAt: Date.now(),
    });
    throw new Error(
      `Unable to refresh feed articles: received ${feedResponse.status} ${feedResponse.statusText} response from feed URL ${feed.url}`
    );
  }

  db.feeds.update(feed.url, {
    etag: feedResponse.headers.get("Etag"),
    lastModified: feedResponse.headers.get("Last-Modified"),
    lastRefreshedAt: Date.now(),
  });

  const feedText = await feedResponse.text();

  switch (feedResponse.headers.get("content-type")) {
    case "application/atom+xml":
      return processAtomFeedResponse(
        feed.url,
        domParser.parseFromString(feedText, "application/xml")
      );
    case "application/rss+xml":
      return processRSSFeedResponse(
        feed.url,
        domParser.parseFromString(feedText, "application/xml")
      );
    case "application/feed+json":
    case "application/json":
      return processJSONFeedResponse(feed.url, JSON.parse(feedText));
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
      return processJSONFeedResponse(feed.url, feedJSON);
    }
  }

  // Attempt to parse the feed as XML and determine if it's an Atom or RSS feed
  const feedDocument = domParser.parseFromString(feedText, "application/xml");
  const rootElement = feedDocument.documentElement;
  if (
    rootElement.tagName === "feed" &&
    rootElement.namespaceURI === "http://www.w3.org/2005/Atom"
  ) {
    return processAtomFeedResponse(feed.url, feedDocument);
  } else if (rootElement.tagName === "rss") {
    return processRSSFeedResponse(feed.url, feedDocument);
  } else {
    throw new Error(
      `Received unrecognized XML feed format for feed URL ${feed.url}`
    );
  }
}

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

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const newArticlesCount = await refreshArticlesForFeed(feed);
      onProgress(++refreshedFeedCount / feedCount, newArticlesCount > 0);
    })
  );

  for (let i = 0, numResults = results.length; i < numResults; ++i) {
    const result = results[i];
    if (result.status === "rejected") {
      console.error(
        `Failed to refresh articles for feed ${feeds[i]}:`,
        result.reason
      );
    }
  }

  window.dispatchEvent(new CustomEvent("reader:feeds-updated"));

  onComplete();
}
