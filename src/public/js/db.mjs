import { Dexie } from "/lib/dexie.mjs";
/**
 * @import { Dexie as TDexie, Table } from "/lib/dexie.d.ts";
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
 *  title: string;
 *  publishedAt: number;
 *  readAt: number | null;
 *  thumbnail: {
 *    url: string;
 *    alt: string;
 *  } | "NO_THUMBNAIL" | null;
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

db.version(1.1).stores({
  feeds: "url, title",
  articles: "url, feedURL, title, publishedAt, readAt",
  settings: "name",
});
