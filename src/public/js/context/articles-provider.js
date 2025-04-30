import {
  LitElement,
  ContextProvider,
  ContextConsumer,
  html,
  css,
} from "/lib/lit.js";
import { articlesContext } from "/js/context/articlesContext.js";
import { filtersContext } from "./filtersContext.js";
import { db } from "/js/db.js";
import { Dexie } from "/lib/dexie.js";
import { refreshAllArticles } from "../refreshArticles.js";

const pageNumberParam =
  Number(new URLSearchParams(window.location.search).get("page")) || 1;

/**
 * @import { ArticlesContextValue } from './articlesContext.js';
 * @import { FiltersContextValue } from './filtersContext.js';
 */
export default class ArticlesProvider extends LitElement {
  static tagName = "articles-provider";

  static PAGE_SIZE = 20;

  static styles = css`
    :host {
      display: contents;
    }
  `;

  constructor() {
    super();

    /**
     * @type {typeof articlesContext.__context__}
     */
    this._contextValue = {
      articleURLs: [],
      isLoadingArticles: true,
      totalArticleCount: 0,
      refreshProgress: 0,
      isRefreshing: true,
      areArticlesStale: false,
      pageNumber: pageNumberParam,
      pageSize: ArticlesProvider.PAGE_SIZE,
    };

    this._provider = new ContextProvider(this, {
      context: articlesContext,
      initialValue: this._contextValue,
    });

    this._filtersContextConsumer = new ContextConsumer(this, {
      context: filtersContext,
      callback: (newFiltersContext) => {
        this.updateArticlesList(newFiltersContext);
      },
      subscribe: true,
    });
  }

  connectedCallback() {
    super.connectedCallback();

    refreshAllArticles({
      onProgress: (progress, hasNewArticles) => {
        this.updateContextValue({
          refreshProgress: progress,
          isRefreshing: true,
          areArticlesStale:
            this._contextValue.areArticlesStale || hasNewArticles,
        });
      },
      onComplete: () => {
        this.updateContextValue({
          refreshProgress: 1,
          isRefreshing: false,
        });
      },
    });
  }

  /**
   * @param {Partial<ArticlesContextValue>} updatedContextValue
   */
  updateContextValue(updatedContextValue) {
    this._contextValue = {
      ...this._contextValue,
      ...updatedContextValue,
    };

    this._provider.setValue(this._contextValue);
  }

  /**
   * @param {FiltersContextValue} [filtersContextValue]
   * @returns {Promise<void>}
   */
  async updateArticlesList(
    filtersContextValue = this._filtersContextConsumer.value
  ) {
    if (!filtersContextValue) {
      throw new Error("Filters context value is not available");
    }

    const { includeRead, includeUnread } = filtersContextValue;

    this.updateContextValue({
      areArticlesStale: false,
      isLoadingArticles: true,
    });

    const searchParams = new URLSearchParams(window.location.search);
    const filterFeedURL = searchParams.get("filter-feed-url");

    let articlesCollection;

    if (filterFeedURL) {
      if (includeRead && includeUnread) {
        articlesCollection = db.articles
          .where(["feedURL", "publishedAt"])
          .between(
            [filterFeedURL, Dexie.minKey],
            [filterFeedURL, Dexie.maxKey]
          );
      } else {
        articlesCollection = db.articles
          .where(["feedURL", "read", "publishedAt"])
          .between(
            [filterFeedURL, includeUnread ? 0 : 1, Dexie.minKey],
            [filterFeedURL, includeRead ? 1 : 0, Dexie.maxKey]
          );
      }
    } else {
      if (includeRead && includeUnread) {
        articlesCollection = db.articles.orderBy("publishedAt");
      } else {
        articlesCollection = db.articles
          .where(["read", "publishedAt"])
          .between(
            [includeUnread ? 0 : 1, Dexie.minKey],
            [includeRead ? 1 : 0, Dexie.maxKey]
          );
      }
    }

    const totalArticleCount = await articlesCollection.count();

    const pageNumber = Math.min(
      pageNumberParam,
      // Clamp so we can't go to a page that doesn't exist
      Math.max(Math.ceil(totalArticleCount / ArticlesProvider.PAGE_SIZE), 1)
    );

    const pageStartIndex = (pageNumber - 1) * ArticlesProvider.PAGE_SIZE;

    this.updateContextValue({
      totalArticleCount: await articlesCollection.count(),
      articleURLs: await articlesCollection
        .reverse()
        .offset(pageStartIndex)
        .limit(ArticlesProvider.PAGE_SIZE)
        .primaryKeys(),
      pageNumber,
      pageSize: ArticlesProvider.PAGE_SIZE,
      isLoadingArticles: false,
    });
  }

  render() {
    return html`<slot></slot>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
