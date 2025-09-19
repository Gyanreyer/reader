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
    headers: feedsEtag
      ? {
          "If-None-Match": feedsEtag,
        }
      : undefined,
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

  const responseEtag = feedsResponse.headers.get("Etag");

  if (responseEtag) {
    localStorage.setItem(FEEDS_ETAG_LOCALSTORAGE_KEY, responseEtag);
  }

  /**
   * @type {string[]}
   */
  const feedURLs = await feedsResponse.json();

  /**
   * @type {Set<string>}
   */
  const currentFeedURLsSet = new Set(feedURLs);

  await db.transaction("rw", db.feeds, db.articles, async () => {
    const existingFeedURLs = await db.feeds.toCollection().primaryKeys();
    const existingFeedURLsSet = new Set(existingFeedURLs);

    // All feed URLs that exist in the current feed list bot not in the existing feed list
    // in the DB are new and need to be added
    const newFeedURLsToAdd = Array.from(currentFeedURLsSet.difference(existingFeedURLsSet));
    // All feed URLs that exist in the DB but not in the current feed list need to be deleted
    const feedURLsToDelete = Array.from(existingFeedURLsSet.difference(currentFeedURLsSet));

    // Write all updated feeds to the DB
    return Promise.all([
      db.feeds.bulkPut(
        newFeedURLsToAdd.map((url) => {
          return {
            url,
            title: url,
            lastRefreshedAt: 0,
          };
        })
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
