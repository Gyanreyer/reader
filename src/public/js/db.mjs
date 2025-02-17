import { Dexie } from "/lib/dexie.mjs";
/**
 * @import { Dexie as TDexie, Table } from "/lib/dexie.d.ts";
 */

/**
 * @typedef {{
 *  url: string;
 * } & ({
 *  etag?: null; lastModified: string;
 * } | {
 *  etag: string; lastModified?: null;
 * })} ETagData
 */

/**
 * @typedef {{
 *  url: string;
 *  title: string;
 * }} Feed
 */

/**
 * @typedef {{
 *  url: string;
 *  feedURL: string;
 *  title: string;
 *  publishedAt: number;
 *  readAt: number | null;
 *  thumbnailURL: string | null | "NO_THUMBNAIL";
 * }} Article
 */

/**
 * @type {TDexie & {
 *   etags: Table<ETagData, ETagData["url"]>;
 *   feeds: Table<Feed, Feed["url"]>;
 *   articles: Table<Article, Article["url"]>
 * }}
 */
export const db = /** @type {any} */ (new Dexie("FeedsDatabase"));

db.version(1).stores({
  etags: "url",
  feeds: "url, title",
  articles: "url, feedURL, title, publishedAt, readAt",
});
