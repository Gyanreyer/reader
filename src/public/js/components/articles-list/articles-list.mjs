import { css, html, LitElement, repeat } from "/lib/lit.mjs";

import { db } from "/js/db.mjs";
import { refreshAllArticles } from "/js/refreshArticles.mjs";

import "./article-list-item.mjs";

export class ArticlesList extends LitElement {
  static PAGE_SIZE = 48;

  static get properties() {
    return {
      _articleURLs: {
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
    window.addEventListener("reader:articles-updated", this._onArticlesUpdated);

    refreshAllArticles();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener("reader:feeds-updated", this._onArticlesUpdated);
    window.removeEventListener(
      "reader:articles-updated",
      this._onArticlesUpdated
    );
  }

  async _updateArticlesList() {
    this._areArticlesStale = false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const searchParams = new URLSearchParams(window.location.search);
    const filterFeedURL = searchParams.get("filter-feed-url");

    const feedURLs = filterFeedURL
      ? [filterFeedURL]
      : await db.feeds.toCollection().primaryKeys();

    const feedSet = new Set(feedURLs);

    // It's surprisingly faster to just get the full list of articles and filter/paginate them in memory. Hmm.
    const allArticleURLs = await db.articles
      .orderBy("publishedAt")
      .reverse()
      .and(
        (article) =>
          (feedSet.has(article.feedURL) && article.readAt === null) ||
          article.readAt === undefined ||
          article.readAt > fiveMinutesAgo
      )
      .primaryKeys();

    const currentPage = Number(searchParams.get("page")) || 1;

    const pageStartIndex = (currentPage - 1) * ArticlesList.PAGE_SIZE;

    this._articleURLs = allArticleURLs.slice(
      pageStartIndex,
      pageStartIndex + ArticlesList.PAGE_SIZE
    );
    this._totalArticleCount = allArticleURLs.length;

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
