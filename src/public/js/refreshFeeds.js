import { db } from "./db.js";

const FEEDS_URL = new URL("/feeds.json", window.location.origin).toString();

const FEEDS_ETAG_LOCALSTORAGE_KEY = "feedsEtag";

/**
 * @returns {Promise<boolean>} true if the feed list changed, false otherwise
 */
export async function refreshFeeds() {
  const feedsEtag = localStorage.getItem(FEEDS_ETAG_LOCALSTORAGE_KEY);

  const feedsResponse = await fetch(FEEDS_URL, {
    method: "GET",
    headers: {
      "If-None-Match": feedsEtag,
    },
  });

  if (feedsResponse.status === 304) {
    // The feeds are unchanged, no need to update the database
    return false;
  }

  if (!feedsResponse.ok) {
    console.error(
      `Unable to refresh feed list: received ${feedsResponse.status} ${feedsResponse.statusText} response from feed list URL ${FEEDS_URL}`
    );
    return false;
  }

  localStorage.setItem(
    FEEDS_ETAG_LOCALSTORAGE_KEY,
    feedsResponse.headers.get("Etag")
  );

  /**
   * @type {{
   *  name: string;
   *  url: string;
   * }[]}
   */
  const feeds = await feedsResponse.json();

  /**
   * @type {Map<string, { title: string; url: string }>}
   */
  const allFeedsMap = new Map();
  for (const feed of feeds) {
    allFeedsMap.set(feed.url, {
      title: feed.name,
      url: feed.url,
    });
  }

  const newFeedURLsSet = new Set(allFeedsMap.keys());

  await db.transaction("rw", db.feeds, db.articles, async () => {
    const existingFeedURLs = await db.feeds.toCollection().primaryKeys();
    const feedURLsToDelete = [];
    const feedURLsToUpdate = [];

    for (const feedURL of existingFeedURLs) {
      if (allFeedsMap.has(feedURL)) {
        feedURLsToUpdate.push(feedURL);
      } else {
        feedURLsToDelete.push(feedURL);
      }
      newFeedURLsSet.delete(feedURL);
    }

    const feedURLsToAdd = Array.from(newFeedURLsSet);

    // Write all updated feeds to the DB
    return Promise.all([
      db.feeds.bulkUpdate(
        feedURLsToUpdate.map((url) => ({
          key: url,
          changes: allFeedsMap.get(url),
        }))
      ),
      db.feeds.bulkPut(
        feedURLsToAdd.map((url) => ({
          ...allFeedsMap.get(url),
          lastRefreshedAt: 0,
        }))
      ),
      // Delete feeds that have been removed
      db.feeds.where("url").anyOf(feedURLsToDelete).delete(),
      // Delete articles for feeds that have been removed
      db.articles.where("feedURL").anyOf(feedURLsToDelete).delete(),
    ]);
  });

  window.dispatchEvent(new CustomEvent("reader:feeds-updated"));

  return true;
}
