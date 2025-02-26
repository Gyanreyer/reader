import { css, html, LitElement, repeat } from "/lib/lit.js";
import { Dexie, liveQuery } from "/lib/dexie.js";

import { db } from "/js/db.js";
import { refreshAllArticles } from "/js/refreshArticles.js";
import { settings } from "/js/settings.js";

import "./article-list-item.js";

export class ArticlesList extends LitElement {
  static PAGE_SIZE = 48;

  static get properties() {
    return {
      _articleURLs: {
        state: true,
      },
      _filter_IncludeUnread: {
        state: true,
      },
      _filter_IncludeRead: {
        state: true,
      },
    };
  }

  static styles = css`
    ul {
      list-style-type: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    #filters-button {
      position: fixed;
      inset-block-start: 1rem;
      inset-inline-end: 1rem;
      z-index: 1;
    }
  `;

  constructor() {
    super();

    /**
     * @type {string[]}
     */
    this._articleURLs = [];
    this._totalArticleCount = 0;

    /**
     * Tracks whether the articles list is stale and should be updated.
     * This is set to true whenever the list of feeds or articles is updated.
     * @type {boolean}
     */
    this._areArticlesStale = true;

    this._onArticlesUpdated = () => {
      this._areArticlesStale = true;
      this._updateArticlesList();
    };
    window.addEventListener("reader:feeds-updated", this._onArticlesUpdated);
    window.addEventListener(
      "reader:all-articles-refreshed",
      this._onArticlesUpdated
    );

    this._updateArticlesList();
    refreshAllArticles();

    /**
     * @type {boolean | null}
     */
    this._filter_IncludeUnread = null;
    /**
     * @type {boolean | null}
     */
    this._filter_IncludeRead = null;

    this._settingsSubscription = liveQuery(async () => ({
      filter_IncludeUnread: await settings.get("filter_IncludeUnread"),
      filter_IncludeRead: await settings.get("filter_IncludeRead"),
    })).subscribe(({ filter_IncludeUnread, filter_IncludeRead }) => {
      this._filter_IncludeUnread = filter_IncludeUnread;
      this._filter_IncludeRead = filter_IncludeRead;
      this._updateArticlesList();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener("reader:feeds-updated", this._onArticlesUpdated);
    window.removeEventListener(
      "reader:articles-updated",
      this._onArticlesUpdated
    );

    this._settingsSubscription.unsubscribe();
  }

  /**
   * @returns {Promise<void>}
   */
  async _updateArticlesList() {
    this._areArticlesStale = false;

    const searchParams = new URLSearchParams(window.location.search);
    const filterFeedURL = searchParams.get("filter-feed-url");

    const currentPage = Number(searchParams.get("page")) || 1;

    const pageStartIndex = (currentPage - 1) * ArticlesList.PAGE_SIZE;

    let articlesCollection;

    this._filter_IncludeRead ??= await settings.get("filter_IncludeRead");
    this._filter_IncludeUnread ??= await settings.get("filter_IncludeUnread");

    if (filterFeedURL) {
      if (this._filter_IncludeRead && this._filter_IncludeUnread) {
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
            [filterFeedURL, this._filter_IncludeUnread ? 0 : 1, Dexie.minKey],
            [filterFeedURL, this._filter_IncludeRead ? 1 : 0, Dexie.maxKey]
          );
      }
    } else {
      if (this._filter_IncludeRead && this._filter_IncludeUnread) {
        articlesCollection = db.articles.orderBy("publishedAt");
      } else {
        articlesCollection = db.articles
          .where(["read", "publishedAt"])
          .between(
            [this._filter_IncludeUnread ? 0 : 1, Dexie.minKey],
            [this._filter_IncludeRead ? 1 : 0, Dexie.maxKey]
          );
      }
    }

    this._totalArticleCount = await articlesCollection.count();
    this._articleURLs = await articlesCollection
      .reverse()
      .offset(pageStartIndex)
      .limit(ArticlesList.PAGE_SIZE)
      .primaryKeys();

    if (this._areArticlesStale) {
      return this._updateArticlesList();
    }
  }

  render() {
    const searchParams = new URLSearchParams(window.location.search);

    const currentPageNumber = Number(searchParams.get("page")) || 1;

    const nextPageParams = new URLSearchParams(searchParams);
    nextPageParams.set("page", String(currentPageNumber + 1));

    const previousPageParams = new URLSearchParams(searchParams);
    previousPageParams.set("page", String(currentPageNumber - 1));

    const hasPreviousPage = currentPageNumber > 1;
    const hasNextPage =
      this._totalArticleCount > currentPageNumber * ArticlesList.PAGE_SIZE;

    return html`
      <button
        aria-label="Filter settings"
        popovertarget="filters-popover"
        id="filters-button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/spritesheet.svg#filter-icon"></use>
        </svg>
      </button>
      <div popover id="filters-popover">
        <label>
          Include unread
          <input
            type="checkbox"
            id="filter-include-unread"
            ?checked="${settings.get("filter_IncludeUnread")}"
            @change="${
              /**
               * @param {Event & { target: HTMLInputElement }} event
               */
              (event) =>
                settings.set("filter_IncludeUnread", event.target.checked)
            }"
          />
        </label>
        ${this._filter_IncludeRead !== null
          ? html`<label>
              Include read
              <input
                type="checkbox"
                id="filter-include-read"
                ?checked="${this._filter_IncludeRead}"
                @change="${
                  /**
                   * @param {Event & { target: HTMLInputElement }} event
                   */
                  (event) =>
                    settings.set("filter_IncludeRead", event.target.checked)
                }"
              />
            </label>`
          : null}
      </div>
      <ul>
        ${repeat(
          this._articleURLs,
          (url) => url,
          (url) =>
            html`<li>
              <article-list-item url=${url}></article-list-item>
            </li>`
        )}
      </ul>
      <div>
        ${hasPreviousPage
          ? html`<a href="?${previousPageParams.toString()}">Previous page</a>`
          : null}
        ${hasNextPage
          ? html`<a href="?${nextPageParams.toString()}">Next page</a>`
          : null}
      </div>
    `;
  }

  static {
    customElements.define("articles-list", ArticlesList);
  }
}
