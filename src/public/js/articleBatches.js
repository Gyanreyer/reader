import { db } from "./db.js";

/**
 * @import { Article } from './db.js';
 */

/**
 * Each batch keeps adding whole discovered days until it has at least this many articles.
 */
const MIN_BATCH_SIZE = 20;

/**
 * @typedef {{
 *  feedURL: string;
 *  feedTitle: string;
 *  articleURLs: string[];
 * }} FeedGroup
 */

/**
 * @typedef {{
 *  start: number; // Local midnight at the start of the discovered day
 *  items: Array<FeedGroup | string>; // Feed groups, or the URLs of articles shown on their own
 * }} DiscoveredDay
 */

/**
 * @typedef {{
 *  includeRead: boolean;
 *  includeUnread: boolean;
 *  filterFeedURL: string | null;
 * }} ArticleFilters
 */

/**
 * @param {number} timestamp
 * @returns {number} Local midnight at the start of the timestamp's day, in the browser's time zone
 */
export function getDayStart(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Picks the index to read articles from for the given filters, and the key prefixes within that index which
 * match the filters. Each prefix is followed by discoveredAt in the index.
 *
 * @param {ArticleFilters} filters
 * @returns {{ index: string; prefixes: Array<Array<string | number>> }}
 */
function getIndexRanges({ includeRead, includeUnread, filterFeedURL }) {
  // "Unread" includes articles read this session (1) so they don't disappear as soon as they're read
  const minRead = includeUnread ? 0 : 1;
  const maxRead = includeRead ? 2 : 1;

  if (minRead === 0 && maxRead === 2) {
    return filterFeedURL
      ? { index: "[feedURL+discoveredAt]", prefixes: [[filterFeedURL]] }
      : { index: "[discoveredAt+publishedAt]", prefixes: [[]] };
  }

  /**
   * @type {number[]}
   */
  const readValues = [];
  for (let read = minRead; read <= maxRead; ++read) {
    readValues.push(read);
  }

  return filterFeedURL
    ? {
      index: "[feedURL+read+discoveredAt]",
      prefixes: readValues.map((read) => [filterFeedURL, read]),
    }
    : {
      index: "[read+discoveredAt+publishedAt]",
      prefixes: readValues.map((read) => [read]),
    };
}

/**
 * @param {Article} a
 * @param {Article} b
 */
const compareNewestDiscoveredFirst = (a, b) =>
  b.discoveredAt - a.discoveredAt || b.publishedAt - a.publishedAt;

/**
 * Gets the articles matching the filters which were discovered in [lower, upper), newest first.
 *
 * @param {ArticleFilters} filters
 * @param {number} lower
 * @param {number} upper
 * @param {number} [limit]
 * @returns {Promise<Article[]>}
 */
async function getArticlesDiscoveredBetween(filters, lower, upper, limit) {
  const { index, prefixes } = getIndexRanges(filters);

  // Each read value is a separate range of the index, so query them separately and merge the results
  const results = await Promise.all(
    prefixes.map((prefix) => {
      let collection = db.articles
        .where(index)
        .between([...prefix, lower], [...prefix, upper], true, false)
        .reverse();
      if (limit !== undefined) {
        collection = collection.limit(limit);
      }
      return collection.toArray();
    })
  );

  const articles = results.flat().sort(compareNewestDiscoveredFirst);
  return limit !== undefined ? articles.slice(0, limit) : articles;
}

/**
 * Groups one discovered day's articles by feed. Articles are sorted newest published first, and each feed group
 * takes the place of its first article, so feed groups are ordered by their newest article and list their
 * articles newest first.
 *
 * @param {Article[]} articles
 * @param {boolean} shouldGroupByFeed
 * @param {Map<string, string>} feedTitles
 * @returns {Array<FeedGroup | string>}
 */
function getDayItems(articles, shouldGroupByFeed, feedTitles) {
  const sortedArticles = articles.toSorted(
    (a, b) => b.publishedAt - a.publishedAt
  );

  if (!shouldGroupByFeed) {
    return sortedArticles.map((article) => article.url);
  }

  /**
   * @type {Array<FeedGroup | string>}
   */
  const items = [];
  /**
   * @type {Map<string, number>}
   */
  const feedItemIndices = new Map();

  for (const article of sortedArticles) {
    const feedItemIndex = feedItemIndices.get(article.feedURL);
    if (feedItemIndex === undefined) {
      feedItemIndices.set(article.feedURL, items.push(article.url) - 1);
      continue;
    }

    const feedItem = items[feedItemIndex];
    if (typeof feedItem === "string") {
      items[feedItemIndex] = {
        feedURL: article.feedURL,
        feedTitle: feedTitles.get(article.feedURL) ?? article.feedURL,
        articleURLs: [feedItem, article.url],
      };
    } else {
      feedItem.articleURLs.push(article.url);
    }
  }

  return items;
}

/**
 * Loads the next batch of whole discovered days before the cursor. A batch keeps adding days until it has
 * at least MIN_BATCH_SIZE articles, and never splits a day.
 *
 * @param {ArticleFilters} filters
 * @param {number} cursor The start of the oldest day already loaded, or Infinity for the first batch
 * @returns {Promise<{
 *  days: DiscoveredDay[];
 *  nextCursor: number;
 *  hasMoreArticles: boolean;
 * }>}
 */
export async function getArticleBatch(filters, cursor) {
  const newestArticles = await getArticlesDiscoveredBetween(
    filters,
    -Infinity,
    cursor,
    MIN_BATCH_SIZE
  );

  if (newestArticles.length === 0) {
    return { days: [], nextCursor: cursor, hasMoreArticles: false };
  }

  // Load the rest of the day that the last of these articles was discovered on
  const nextCursor = getDayStart(
    newestArticles[newestArticles.length - 1].discoveredAt
  );

  const [articles, olderArticles] = await Promise.all([
    getArticlesDiscoveredBetween(filters, nextCursor, cursor),
    getArticlesDiscoveredBetween(filters, -Infinity, nextCursor, 1),
  ]);

  // The single-feed view already names the feed, so it isn't grouped by feed
  const shouldGroupByFeed = !filters.filterFeedURL;

  /**
   * @type {Map<string, string>}
   */
  const feedTitles = new Map();
  if (shouldGroupByFeed) {
    const feedURLs = [...new Set(articles.map((article) => article.feedURL))];
    const feeds = await db.feeds.bulkGet(feedURLs);
    for (const feed of feeds) {
      if (feed) {
        feedTitles.set(feed.url, feed.title);
      }
    }
  }

  /**
   * @type {DiscoveredDay[]}
   */
  const days = [];
  /**
   * @type {Article[]}
   */
  let dayArticles = [];
  let dayStart = getDayStart(articles[0].discoveredAt);

  // Articles are sorted newest first, so each day's articles are together
  for (const article of articles) {
    const articleDayStart = getDayStart(article.discoveredAt);
    if (articleDayStart !== dayStart) {
      days.push({
        start: dayStart,
        items: getDayItems(dayArticles, shouldGroupByFeed, feedTitles),
      });
      dayArticles = [];
      dayStart = articleDayStart;
    }
    dayArticles.push(article);
  }
  days.push({
    start: dayStart,
    items: getDayItems(dayArticles, shouldGroupByFeed, feedTitles),
  });

  return {
    days,
    nextCursor,
    hasMoreArticles: olderArticles.length > 0,
  };
}
