import { db } from "./db.mjs";
import { refreshFeeds } from "./refreshFeeds.mjs";
import { settings } from "./settings.mjs";
import { getTitleSnippetFromContentText } from "./utils/getTitleSnippetFromContentText.mjs";
import { proxiedFetch } from "./utils/proxiedFetch.mjs";

/**
 * @import { Article } from './db.mjs';
 */

const domParser = new DOMParser();

const sanitizeXMLTitle = (title) =>
  domParser.parseFromString(title, "text/html").body.textContent.trim();

/**
 * @param {{
 *  [articleURL: string]: Article;
 * }} parsedArticles
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
  window.dispatchEvent(new CustomEvent("reader:articles-updated"));
}

/**
 * @param {string} feedURL
 * @param {Record<string, any>} feedJSON
 */
async function processJSONFeedResponse(feedURL, feedJSON) {
  const items = feedJSON.items;
  if (!Array.isArray(items)) {
    throw new Error(
      `Received JSON feed response with missing "items" array for feed URL ${feedURL}`
    );
  }

  /**
   * @type {Record<string, import("./db.mjs").Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  for (const item of items) {
    if (typeof item.url !== "string" || !URL.canParse(item.url)) {
      console.error(
        `Received JSON feed with invalid or missing "url" property for item in feed URL ${feedURL}`
      );
      continue;
    }

    /**
     * @type {string | null}
     */
    let title = null;
    if (typeof item.title === "string") {
      title = item.title.trim();
    } else if (item.content_text && typeof item.content_text === "string") {
      const extractedTitleSnippet = getTitleSnippetFromContentText(
        item.content_text
      );
      if (extractedTitleSnippet) {
        title = extractedTitleSnippet;
      }
    } else if (item.content_html && typeof item.content_html === "string") {
      const parsedContentDocument = domParser.parseFromString(
        item.content_html,
        "text/html"
      );
      const extractedTitleSnippet = getTitleSnippetFromContentText(
        parsedContentDocument.body.textContent
      );
      if (extractedTitleSnippet) {
        title = extractedTitleSnippet;
      }
    }

    let dateTimestamp = item.date_published || item.date_modified;

    /**
     * @type {string | null}
     */
    let thumbnailURL = null;
    if (item.image && URL.canParse(item.imge)) {
      thumbnailURL = item.image.trim();
    } else if (item.banner_image && URL.canParse(item.banner_image)) {
      thumbnailURL = item.banner_image.trim();
    } else if (item.attachments) {
      const imageAttachment = item.attachments.find((attachment) =>
        attachment.mime_type.startsWith("image")
      );
      if (imageAttachment && URL.canParse(imageAttachment.url)) {
        thumbnailURL = imageAttachment.url.trim();
      }
    }

    parsedArticles[item.url] = {
      url: item.url,
      title,
      thumbnail: thumbnailURL
        ? {
            url: thumbnailURL,
            alt: "",
          }
        : null,
      publishedAt: dateTimestamp ? new Date(dateTimestamp.trim()).getTime() : 0,
      feedURL,
      read: 0,
    };
  }

  await updateSavedArticles(parsedArticles);
}

/**
 * We have to account for RSS 0.91, 0.92, and 2.0
 *
 * @param {string} feedURL
 * @param {Document} feedDocument
 */
async function processRSSFeedResponse(feedURL, feedDocument) {
  const items = Array.from(feedDocument.getElementsByTagName("item"));

  /**
   * @type {Record<string, Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  for (const item of items) {
    const articleURL = item.querySelector("link")?.textContent.trim();
    if (!articleURL || !URL.canParse(articleURL)) {
      console.error(
        `Item in RSS feed ${feedURL} has missing or invalid link URL`,
        item.outerHTML
      );
    }

    /**
     * @type {string | null}
     */
    let title = null;
    const titleTagText = item.querySelector("title")?.textContent;
    if (titleTagText) {
      title = sanitizeXMLTitle(titleTagText);
    } else {
      const rawDescriptionText = item.querySelector("description")?.textContent;
      if (rawDescriptionText) {
        const parsedDescriptionDocument = domParser.parseFromString(
          rawDescriptionText,
          "text/html"
        );
        const extractedTitleSnippet = getTitleSnippetFromContentText(
          parsedDescriptionDocument.body.textContent
        );
        if (extractedTitleSnippet) {
          title = extractedTitleSnippet;
        }
      }
    }

    const dateTimestamp = (
      item.querySelector("pubDate") || item.getElementsByTagName("dc:date")?.[0]
    )?.textContent.trim();

    /**
     * @type {string | null}
     */
    let thumbnailURL = null;

    const mediaThumbnailURL = item
      .querySelector("media\\:thumbnail")
      ?.getAttribute("url")
      .trim();
    if (mediaThumbnailURL && URL.canParse(mediaThumbnailURL)) {
      thumbnailURL = mediaThumbnailURL;
    } else {
      const imageEnclosureURL = item
        .querySelector("enclosure[type^='image']")
        ?.getAttribute("url")
        .trim();
      if (imageEnclosureURL && URL.canParse(imageEnclosureURL)) {
        thumbnailURL = imageEnclosureURL;
      }
    }

    thumbnailURL = thumbnailURL ? thumbnailURL.trim() : null;

    parsedArticles[articleURL] = {
      url: articleURL,
      title,
      thumbnail: thumbnailURL
        ? {
            url: thumbnailURL,
            alt: "",
          }
        : null,
      publishedAt: dateTimestamp ? new Date(dateTimestamp).getTime() : 0,
      read: 0,
      feedURL,
    };
  }

  await updateSavedArticles(parsedArticles);
}

/**
 * @param {string} feedURL
 * @param {Document} feedDocument
 */
async function processAtomFeedResponse(feedURL, feedDocument) {
  const entries = feedDocument.getElementsByTagName("entry");

  /**
   * @type {Record<string, Article>} Parsed articles to add to the database
   */
  const parsedArticles = {};

  for (const entry of entries) {
    const articleURL = (
      entry.querySelector("link")?.getAttribute("href") ||
      // Try to recover from a missing link by checking for a URL in an <id>/<guid> tag;
      // these are usually also the article URL
      (entry.querySelector("id") || entry.querySelector("guid"))?.textContent
    )?.trim();
    if (!articleURL || !URL.canParse(articleURL)) {
      console.error(
        `Entry in Atom feed ${feedURL} is missing a valid URL link`,
        entry.outerHTML
      );
      continue;
    }

    let title = null;
    const titleTag = entry.querySelector("title");
    if (titleTag) {
      title = sanitizeXMLTitle(titleTag.textContent);
    }

    if (!title) {
      const rawContentText = entry.querySelector("content")?.textContent;
      if (rawContentText) {
        const parsedContentDocument = domParser.parseFromString(
          rawContentText,
          "text/html"
        );
        const extractedTitleSnippet = getTitleSnippetFromContentText(
          parsedContentDocument.body.textContent
        );
        if (extractedTitleSnippet) {
          title = extractedTitleSnippet.trim();
        }
      }
    }

    const dateTimestamp = (
      entry.querySelector("published") || entry.querySelector("updated")
    )?.textContent.trim();
    if (!dateTimestamp) {
      console.error(
        `Entry in feed ${feedURL} is missing a published or updated date. Will fall back to current date.`,
        entry.outerHTML
      );
    }

    /**
     * @type {string | null}
     */
    let thumbnailURL = null;

    const mediaThumbnailURL = entry
      .querySelector("media\\:thumbnail")
      ?.getAttribute("url")
      .trim();
    if (mediaThumbnailURL && URL.canParse(mediaThumbnailURL)) {
      thumbnailURL = mediaThumbnailURL;
    }

    parsedArticles[articleURL] = {
      url: articleURL,
      title,
      thumbnail: thumbnailURL
        ? {
            url: thumbnailURL,
            alt: "",
          }
        : null,
      publishedAt: dateTimestamp ? new Date(dateTimestamp).getTime() : 0,
      feedURL,
      read: 0,
    };
  }

  await updateSavedArticles(parsedArticles);
}

/**
 * @param {import("./db.mjs").Feed} feed
 * @param {boolean} [shouldForceRefresh=false] If true, the feed will be refreshed regardless of the last refresh time
 */
export async function refreshArticlesForFeed(feed, shouldForceRefresh = false) {
  if (!shouldForceRefresh) {
    const refreshInterval = await settings.get("articleRefreshInterval");
    const lastRefreshedAt = feed.lastRefreshedAt ?? 0;
    // If less time has elapsed since last refresh than the refresh interval, don't refresh
    if (Date.now() - lastRefreshedAt <= refreshInterval) {
      return;
    }
  }

  const headers = new Headers({
    "If-None-Match": feed.etag,
    "If-Modified-Since": feed.lastModified,
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
    return;
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

export async function refreshAllArticles() {
  await refreshFeeds();

  const feeds = await db.feeds.toArray();

  const results = await Promise.allSettled(
    feeds.map((feed) => refreshArticlesForFeed(feed))
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
}
