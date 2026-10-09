import { Dexie } from "/lib/dexie.js";
/**
 * @import { Dexie as TDexie, Table } from "dexie";
 */

/**
 * @typedef {{
 *  url: string;
 *  title: string;
 *  lastRefreshedAt: number | null; // When we last tried to fetch the feed, whether or not it succeeded
 *  lastSuccessfulRefreshAt?: number | null; // When we last fetched the feed successfully; new articles can't count as discovered before this
 *  nextRefreshAt?: number | null; // The earliest time the feed should be fetched again
 *  refreshHint?: number | null; // How often the publisher suggests fetching the feed, in milliseconds
 *  etag?: string | null;
 *  lastModified?: string | null;
 *  failureCount?: number; // The number of consecutive failed fetches, which determines how long we back off for
 *  notFoundCount?: number; // The number of consecutive fetches which returned 404 Not Found
 *  notFoundSince?: number | null; // When the current run of 404s started
 *  deadReason?: string | null; // Set when the feed is dead, explaining why; dead feeds are never fetched again
 *  movedTo?: string | null; // The URL the feed has permanently redirected to
 *  isMultiAuthor?: boolean; // Whether the feed's stored articles credit more than one distinct author
 * }} Feed
 */

/**
 * @typedef {{
 *  url: string;
 *  feedURL: string;
 *  title: string | null;
 *  publishedAt: number;
 *  discoveredAt: number; // The timestamp when the article was first discovered
 *  read: 0 | 1 | 2; // 0 = unread, 1 = read this session, 2 = read in a past session
 *  thumbnail: {
 *    url: string;
 *    alt: string;
 *  } | "NO_THUMBNAIL" | null;
 *  wordCount: number | null;
 *  author?: string | null; // The article's authors as one string, like "Ana, Ben, and Cy"; display only
 * }} Article
 */

/**
 * @typedef {{
 *  name: string;
 *  value: unknown;
 * }} Setting
 */

/**
 * A host which refused or failed an article page fetch, so we shouldn't ask it again until `retryAfter`.
 *
 * @typedef {{
 *  host: string;
 *  retryAfter: number;
 *  reason: string;
 * }} HostFailure
 */

/**
 * @type {TDexie & {
 *   feeds: Table<Feed, Feed["url"]>;
 *   articles: Table<Article, Article["url"]>
 *   settings: Table<Setting, Setting["name"]>
 *   hostFailures: Table<HostFailure, HostFailure["host"]>
 * }}
 */
export const db = /** @type {any} */ (new Dexie("FeedsDatabase"));

db.version(3)
  .stores({
    feeds: "url, title",
    // We have various combinations of compound indexes to support different
    // types of queries depending on the filters applied.
    // When in a mixed feed, we want to order articles by their publish date, but will also want to sort by
    // their "discovered at" date first to ensure that newly discovered articles with stale publish dates are
    // still surfaced appropriately.
    // discoveredAt is not as useful useful when filtering on a single feed, so we omit it from single-feed indices.
    articles:
      "url, [discoveredAt+publishedAt], [read+discoveredAt+publishedAt], [feedURL+read+publishedAt], [feedURL+publishedAt]",
    settings: "name",
  })
  .upgrade(async (tx) =>
    tx
      .table("articles")
      .toCollection()
      .modify((article) => {
        if (article.readAt) {
          article.read =
            article.readAt != null && article.readAt < Infinity ? 2 : 0;
          delete article.readAt;
        }
        if (!article.discoveredAt) {
          article.discoveredAt = article.publishedAt ?? Date.now();
        }
      })
  );

db.version(4).stores({
  hostFailures: "host",
});

db.version(5).stores({
  // Articles are listed by discovered day, so every index is ordered by discoveredAt after the fields being filtered on.
  // The single-feed view sorts each day's articles by publishedAt itself.
  articles:
    "url, [discoveredAt+publishedAt], [read+discoveredAt+publishedAt], [feedURL+discoveredAt], [feedURL+read+discoveredAt]",
});

db.version(6)
  .stores({})
  .upgrade(async (tx) => {
    // Articles used to count as discovered when the refresh which found them ran, so a feed's first fetch (before
    // that was special-cased) or a backlog after a long break all landed on one day. Re-apply the rule from
    // refreshArticles.js: discovered when published, but no earlier than the previous fetch of the feed.
    //
    // We don't know when past fetches ran, but each refresh used to give all of its new articles the same
    // discoveredAt, so a feed's previous batch of articles is the latest we know it was fetched before a given batch.

    /**
     * @type {Map<string, Set<number>>}
     */
    const feedBatches = new Map();
    await tx
      .table("articles")
      .toCollection()
      .each((article) => {
        let batches = feedBatches.get(article.feedURL);
        if (!batches) {
          batches = new Set();
          feedBatches.set(article.feedURL, batches);
        }
        batches.add(article.discoveredAt);
      });

    /**
     * @type {Map<string, Map<number, number>>} For each feed, maps each batch's discoveredAt to the previous batch's
     */
    const previousBatches = new Map();
    for (const [feedURL, batches] of feedBatches) {
      const sortedBatches = [...batches].sort((a, b) => a - b);
      previousBatches.set(
        feedURL,
        new Map(sortedBatches.slice(1).map((batch, i) => [batch, sortedBatches[i]]))
      );
    }

    await tx
      .table("articles")
      .toCollection()
      .modify((article) => {
        if (!(article.publishedAt > 0)) {
          return;
        }
        const previousBatch =
          previousBatches.get(article.feedURL)?.get(article.discoveredAt) ?? 0;
        article.discoveredAt = Math.min(
          Math.max(article.publishedAt, previousBatch),
          article.discoveredAt
        );
      });

    // A feed's latest batch is the last fetch we know succeeded. lastRefreshedAt can't be trusted for this,
    // since it used to be set after failed fetches too.
    await tx
      .table("feeds")
      .toCollection()
      .modify((feed) => {
        const batches = feedBatches.get(feed.url);
        feed.lastSuccessfulRefreshAt = batches ? Math.max(...batches) : null;
      });
  });

db.articles.where({
  read: 1,
}).primaryKeys().then((keys) => {
  // Update all articles which were read in the last session from read: 1 to read: 2
  // so they won't be shown unless the "include read" filter is active.
  if (keys.length > 0) {
    db.articles.bulkUpdate(keys.map((key) => ({
      key,
      changes: { read: 2 },
    })));
  }
});
