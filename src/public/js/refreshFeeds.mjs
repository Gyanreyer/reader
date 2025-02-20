import { db } from "./db.mjs";

const FEEDS_URL = new URL("/feeds.opml", window.location.origin).toString();

/**
 * @returns {Promise<boolean>} true if the feed list changed, false otherwise
 */
export async function refreshFeeds() {
  const feedsEtag =
    (await db.etags.where("url").equals(FEEDS_URL).first())?.etag ?? null;

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

  const newEtag = feedsResponse.headers.get("etag");
  db.etags.put({ url: FEEDS_URL, etag: newEtag });

  const parser = new DOMParser();
  const feedsDocument = parser.parseFromString(
    await feedsResponse.text(),
    "application/xml"
  );

  // Each <outline> tag has the following attributes:
  // text: the title of the feed
  // title: (optional) the title of the feed; use if text is not present
  // type: "rss"
  // xmlUrl: the URL of the feed
  const feedOutlineTags = feedsDocument.querySelectorAll("outline[type=rss]");

  /**
   * @type {{
   *  [feedURL: string]: {
   *    url: string;
   *    title: string;
   *  }
   * }}
   */
  const updatedFeedData = {};
  for (const feedOutlineTag of feedOutlineTags) {
    const feedURL = feedOutlineTag.getAttribute("xmlUrl");
    const feedTitle =
      feedOutlineTag.getAttribute("title") ||
      feedOutlineTag.getAttribute("text") ||
      feedURL;

    if (!URL.canParse(feedURL)) {
      console.error("Encountered invalid feed URL:", feedURL);
      continue;
    }

    updatedFeedData[feedURL] = { url: feedURL, title: feedTitle };
  }

  const allUpdatedFeedURLs = Object.keys(updatedFeedData);

  await db.transaction("rw", db.feeds, () => {
    // Write all updated feeds to the DB
    return Promise.all([
      db.feeds.bulkPut(Object.values(updatedFeedData)),
      // Delete feeds that are have been removed
      db.feeds.where("url").noneOf(allUpdatedFeedURLs).delete(),
    ]);
  });

  window.dispatchEvent(new CustomEvent("reader:feeds-updated"));

  return true;
}
