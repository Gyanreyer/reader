import { Dexie, liveQuery } from "/lib/dexie.js";
import { db } from "../db.js";
import { settings } from "../settings.js";
import { State } from "./State.js";

const urlParams = new URLSearchParams(window.location.search);

const articleFiltersState = new State({
  includeUnread: await settings.get("filter_IncludeUnread"),
  includeRead: await settings.get("filter_IncludeRead"),
  pageNumber: Number(urlParams.get("page")) || 1,
  filterFeedURL: urlParams.get("filter-feed-url") || null,
});

liveQuery(() =>
  Promise.all([
    settings.get("filter_IncludeUnread"),
    settings.get("filter_IncludeRead"),
  ])
).subscribe(([filter_IncludeUnread, filter_IncludeRead]) => {
  articleFiltersState.value.includeUnread = filter_IncludeUnread;
  articleFiltersState.value.includeRead = filter_IncludeRead;
});

/**
 * @typedef ArticlesStateValue
 * @property {string[]} articleURLs
 * @property {number} totalArticleCount
 * @property {boolean} areArticlesStale
 * @property {number} pageSize
 */

const articlesState = new State({
  articleURLs: [],
  totalArticleCount: 0,
  areArticlesStale: true,
  pageSize: 20,
});

export const updateArticles = async () => {
  const { filterFeedURL, includeRead, includeUnread, pageNumber } =
    articleFiltersState.value;

  let articlesCollection;
  if (filterFeedURL) {
    if (includeRead && includeUnread) {
      articlesCollection = db.articles
        .where(["feedURL", "publishedAt"])
        .between([filterFeedURL, Dexie.minKey], [filterFeedURL, Dexie.maxKey]);
    } else {
      articlesCollection = db.articles
        .where(["feedURL", "read", "publishedAt"])
        .between(
          [
            filterFeedURL,
            // If includeUnread is true, make the lower bound 0 to include unread articles, otherwise 1 to start at read
            /** @type {any} */ (includeUnread) ^ 1,
            Dexie.minKey,
          ],
          [
            filterFeedURL,
            // If includeRead is true, make the upper bound 1 to include read articles, otherwise 0 to end at unread
            /** @type {any} */ (includeRead) & 1,
            Dexie.maxKey,
          ]
        );
    }
  } else {
    if (includeRead && includeUnread) {
      articlesCollection = db.articles.orderBy("publishedAt");
    } else {
      articlesCollection = db.articles.where(["read", "publishedAt"]).between(
        [
          // If includeUnread is true, make the lower bound 0 to include unread articles, otherwise 1 to start at read
          /** @type {any} */ (includeUnread) ^ 1,
          Dexie.minKey,
        ],
        [
          // If includeRead is true, make the upper bound 1 to include read articles, otherwise 0 to end at unread
          /** @type {any} */ (includeRead) & 1,
          Dexie.maxKey,
        ]
      );
    }
  }
};

articleFiltersState.subscribe(() => {
  updateArticles();
});
