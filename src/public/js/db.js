import { Dexie } from "/lib/dexie.js";
/**
 * @import { Dexie as TDexie, Table } from "dexie";
 */

/**
 * @typedef {{
 *  url: string;
 *  title: string;
 *  lastRefreshedAt: number | null;
 *  etag?: string | null;
 *  lastModified?: string | null;
 * }} Feed
 */

/**
 * @typedef {{
 *  url: string;
 *  feedURL: string;
 *  title: string | null;
 *  publishedAt: number;
 *  read: 0 | 1 | 2; // 0 = unread, 1 = read this session, 2 = read in a past session
 *  thumbnail: {
 *    url: string;
 *    alt: string;
 *  } | "NO_THUMBNAIL" | null;
 *  wordCount: number | null;
 * }} Article
 */

/**
 * @typedef {{
 *  name: string;
 *  value: unknown;
 * }} Setting
 */

/**
 * @type {TDexie & {
 *   feeds: Table<Feed, Feed["url"]>;
 *   articles: Table<Article, Article["url"]>
 *   settings: Table<Setting, Setting["name"]>
 * }}
 */
export const db = /** @type {any} */ (new Dexie("FeedsDatabase"));

db.version(3)
  .stores({
    feeds: "url, title",
    // We have various combinations of compound indexes to support different
    // types of queries depending on the filters applied.
    articles:
      "url, publishedAt, [read+publishedAt], [feedURL+read+publishedAt], [feedURL+publishedAt]",
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
      })
  );

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
