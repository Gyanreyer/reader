import {
  LitElement,
  ContextProvider,
  ContextConsumer,
  html,
  css,
} from "/lib/lit.js";
import { articlesContext } from "/js/context/articlesContext.js";
import { filtersContext } from "./filtersContext.js";
import { getArticleBatch } from "../articleBatches.js";
import { refreshAllArticles } from "../refreshArticles.js";

/**
 * @import { ArticlesContextValue } from './articlesContext.js';
 * @import { FiltersContextValue } from './filtersContext.js';
 * @import { ArticleFilters } from '../articleBatches.js';
 */
export default class ArticlesProvider extends LitElement {
  static tagName = "articles-provider";

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
      days: [],
      isLoadingArticles: true,
      hasMoreArticles: true,
      refreshProgress: 0,
      isRefreshing: true,
      areArticlesStale: false,
    };

    /**
     * @type {ArticleFilters | null}
     */
    this._filters = null;
    // The start of the oldest discovered day loaded so far
    this._cursor = Infinity;
    // Incremented whenever the list is reset, so batches from before the reset are discarded
    this._listGeneration = 0;
    // Set when the list should be rebuilt as soon as the current Refresh finishes
    this._shouldRebuildListAfterRefresh = false;

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

    // Refresh on page load, only fetching feeds which are due
    this._startRefresh({ isBackground: true });
  }

  /**
   * Scrolls to the top and resets the list to today right away, then refreshes every feed regardless of when
   * it was last fetched, and rebuilds the list once that finishes.
   */
  refresh() {
    this.updateArticlesList();

    if (this._contextValue.isRefreshing) {
      // Don't fetch every feed twice at once; rebuild the list when the current Refresh finishes instead
      this._shouldRebuildListAfterRefresh = true;
      return;
    }

    this._startRefresh({ isBackground: false });
  }

  /**
   * @param {object} options
   * @param {boolean} options.isBackground A background Refresh only fetches feeds which are due, and flags any new
   *  articles rather than rebuilding the list under the reader
   */
  _startRefresh({ isBackground }) {
    this._shouldRebuildListAfterRefresh = !isBackground;

    this.updateContextValue({
      isRefreshing: true,
      refreshProgress: 0,
    });

    refreshAllArticles({
      shouldForceRefresh: !isBackground,
      onProgress: (progress, hasNewArticles) => {
        this.updateContextValue({
          refreshProgress: progress,
          // If the list is going to be rebuilt anyway, there's no need to flag new articles
          areArticlesStale:
            this._contextValue.areArticlesStale ||
            (hasNewArticles && !this._shouldRebuildListAfterRefresh),
        });
      },
      onComplete: () => {
        this.updateContextValue({
          refreshProgress: 1,
          isRefreshing: false,
        });

        if (this._shouldRebuildListAfterRefresh) {
          this._shouldRebuildListAfterRefresh = false;
          this.updateArticlesList();
        }
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
   * Resets the list to the newest discovered days for the current filters, and scrolls back to the top.
   *
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

    this._filters = {
      includeRead,
      includeUnread,
      filterFeedURL: new URLSearchParams(window.location.search).get(
        "filter-feed-url"
      ),
    };
    this._cursor = Infinity;
    const listGeneration = ++this._listGeneration;

    this.updateContextValue({
      days: [],
      hasMoreArticles: true,
      areArticlesStale: false,
    });

    // Above 600px <main> scrolls, and below it the window does
    document.querySelector("main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });

    await this._loadNextBatch(listGeneration);
  }

  /**
   * Loads the next batch of older discovered days onto the end of the list.
   *
   * @returns {Promise<void>}
   */
  async loadMoreArticles() {
    if (
      !this._filters ||
      this._contextValue.isLoadingArticles ||
      !this._contextValue.hasMoreArticles
    ) {
      return;
    }

    await this._loadNextBatch(this._listGeneration);
  }

  /**
   * @param {number} listGeneration
   */
  async _loadNextBatch(listGeneration) {
    if (!this._filters) {
      return;
    }

    this.updateContextValue({
      isLoadingArticles: true,
    });

    try {
      const { days, nextCursor, hasMoreArticles } = await getArticleBatch(
        this._filters,
        this._cursor
      );

      if (listGeneration !== this._listGeneration) {
        // The list was reset while this batch was loading
        return;
      }

      this._cursor = nextCursor;
      this.updateContextValue({
        days: [...this._contextValue.days, ...days],
        hasMoreArticles,
        isLoadingArticles: false,
      });
    } catch (e) {
      console.error("Failed to load articles:", e);
      if (listGeneration === this._listGeneration) {
        // Stop trying to load more, so a persistent error doesn't make us retry forever
        this.updateContextValue({
          hasMoreArticles: false,
          isLoadingArticles: false,
        });
      }
    }
  }

  render() {
    return html`<slot></slot>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
