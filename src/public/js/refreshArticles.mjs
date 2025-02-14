import { db } from "./db.mjs";
// import { getMetadataForURL } from "./getOGImageForURL.mjs";
import { refreshFeeds } from "./refreshFeeds.mjs";
import { getTitleSnippetFromContentText } from "./utils/getTitleSnippetFromContentText.mjs";
import { proxiedFetch } from "./utils/proxiedFetch.mjs";

const domParser = new DOMParser();

/**
 * @typedef {{
 *    url: string;
 *    title: string;
 *    publishedAt: number;
 *    thumbnailURL: string | null;
 *  }} ParsedArticleData
 */

/**
 * @param {string} feedURL
 * @param {{
 *  [articleURL: string]: ParsedArticleData;
 * }} parsedArticles
 */
async function updateSavedArticles(feedURL, parsedArticles) {
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
          article.feedURL = feedURL;
          article.title = latestArticleData.title;
          article.publishedAt = latestArticleData.publishedAt;
        }
      });

    await Promise.allSettled(
      Array.from(articleURLsToAdd.values()).map(async (articleURL) => {
        const articleData = parsedArticles[articleURL];

        // if (!articleData.thumbnailURL || !articleData.title) {
        //   try {
        //     const { title, thumbnailURL } = await getMetadataForURL(
        //       articleData.url
        //     );
        //     articleData.title = articleData.title || title;
        //     articleData.thumbnailURL = articleData.thumbnailURL || thumbnailURL;
        //   } catch (error) {
        //     console.error(
        //       `Failed to fetch metadata for article URL ${articleData.url}:`,
        //       error
        //     );
        //   }
        // }

        return db.articles.put({
          feedURL,
          readAt: null,
          ...articleData,
        });
      })
    );
  });
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
   * @type {Record<string, ParsedArticleData>} Parsed articles to add to the database
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
      title = item.title;
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

    title = title.trim();

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
      thumbnailURL,
      publishedAt: dateTimestamp
        ? new Date(dateTimestamp.trim()).getTime()
        : Date.now(),
    };
  }

  await updateSavedArticles(feedURL, parsedArticles);
}

/**
 * We have to account for RSS 0.91, 0.92, and 2.0
 *
 * @param {Response} feedResponse
 */
async function processRSSFeedResponse(feedURL, feedDocument) {
  const items = Array.from(feedDocument.getElementsByTagName("item"));

  /**
   * @type {Record<string, ParsedArticleData>} Parsed articles to add to the database
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
      title = titleTagText;
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

    title = title ? title.trim() : null;

    const dateTimestamp = item.querySelector("pubDate")?.textContent.trim();

    /**
     * @type {string | null}
     */
    let thumbnailURL = null;

    const mediaThumbnailURL = item
      .querySelector("media\\:thumbnail")
      ?.getAttribute("url")
      .trim();
    if (mediaThumbnailURL && URL.canParse(mediaThumbnailURL)) {
      thumbnailURL = mediaThumbnail;
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
      thumbnailURL,
      publishedAt: dateTimestamp
        ? new Date(dateTimestamp).getTime()
        : Date.now(),
    };
  }

  await updateSavedArticles(feedURL, parsedArticles);
}

/**
 * @param {Response} feedResponse
 */
async function processAtomFeedResponse(feedURL, feedDocument) {
  const entries = feedDocument.getElementsByTagName("entry");

  /**
   * @type {Record<string, ParsedArticleData>} Parsed articles to add to the database
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

    let title = entry.querySelector("title")?.textContent.trim() ?? null;

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
      thumbnailURL,
      publishedAt: dateTimestamp
        ? new Date(dateTimestamp).getTime()
        : Date.now(),
    };
  }

  await updateSavedArticles(feedURL, parsedArticles);
}

/**
 * @param {string} feedURL
 */
export async function refreshArticlesForFeed(feedURL) {
  const feedEtagData =
    (await db.etags.where("url").equals(feedURL).first()) ?? null;

  let headers;
  if (feedEtagData) {
    if (feedEtagData.etag) {
      headers = {
        "If-None-Match": feedEtagData.etag,
      };
    } else if (feedEtagData.lastModified) {
      // Some hosts which don't support etags may still support If-Modified-Since
      headers = {
        "If-Modified-Since": feedEtagData.lastModified,
      };
    }
  }

  const feedResponse = await proxiedFetch(feedURL, {
    method: "GET",
    headers,
  });

  if (feedResponse.status === 304) {
    // The feed is unchanged, no need to update the database
    return;
  }

  if (!feedResponse.ok) {
    throw new Error(
      `Unable to refresh feed articles: received ${feedResponse.status} ${feedResponse.statusText} response from feed URL ${feedURL}`
    );
  }

  const newEtag = feedResponse.headers.get("Etag");
  if (newEtag) {
    db.etags.put({ url: feedURL, etag: newEtag });
  } else {
    const lastModified =
      feedResponse.headers.get("Last-Modified") ||
      // Fall back to the current date if the response doesn't provide a last modified header
      // Last-Modified dates are always in UTC
      new Date().toUTCString();
    db.etags.put({ url: feedURL, lastModified });
  }

  const feedText = await feedResponse.text();

  switch (feedResponse.headers.get("content-type")) {
    case "application/atom+xml":
      return processAtomFeedResponse(
        feedURL,
        domParser.parseFromString(feedText, "application/xml")
      );
    case "application/rss+xml":
      return processRSSFeedResponse(
        feedURL,
        domParser.parseFromString(feedText, "application/xml")
      );
    case "application/feed+json":
    case "application/json":
      return processJSONFeedResponse(feedURL, JSON.parse(feedText));
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
      return processJSONFeedResponse(feedURL, feedJSON);
    }
  }

  // Attempt to parse the feed as XML and determine if it's an Atom or RSS feed
  const feedDocument = domParser.parseFromString(feedText, "application/xml");
  const rootElement = feedDocument.documentElement;
  if (
    rootElement.tagName === "feed" &&
    rootElement.namespaceURI === "http://www.w3.org/2005/Atom"
  ) {
    return processAtomFeedResponse(feedURL, feedDocument);
  } else if (rootElement.tagName === "rss") {
    return processRSSFeedResponse(feedURL, feedDocument);
  } else {
    throw new Error(
      `Received unrecognized XML feed format for feed URL ${feedURL}`
    );
  }
}

export async function refreshAllArticles() {
  await refreshFeeds();

  const feedURLs = await db.feeds.toCollection().primaryKeys();

  const results = await Promise.allSettled(
    feedURLs.map((feedURL) => refreshArticlesForFeed(feedURL))
  );

  for (let i = 0, numResults = results.length; i < numResults; ++i) {
    if (results[i].status === "rejected") {
      console.error(
        `Failed to refresh articles for feed ${feedURLs[i]}:`,
        results[i].reason
      );
    }
  }
}

refreshAllArticles();
