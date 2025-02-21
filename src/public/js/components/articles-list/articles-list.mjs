import { css, html, LitElement, repeat } from "/lib/lit.mjs";
import { db } from "/js/db.mjs";

import "./article-list-item.mjs";
import { refreshAllArticles } from "/js/refreshArticles.mjs";

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
     * @type {string[]}
     */
    this._feedURLs = [];

    this._onFeedsUpdated = async () => {
      this._feedURLs = await db.feeds.toCollection().primaryKeys();
      await this._hydrateArticlesList();
    };
    window.addEventListener("reader:feeds-updated", this._onFeedsUpdated);

    this._onArticlesUpdated = async () => {
      this._hydrateArticlesList();
    };
    window.addEventListener("reader:articles-updated", this._onArticlesUpdated);

    this._onFeedsUpdated();

    refreshAllArticles();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener("reader:feeds-updated", this._onFeedsUpdated);
    window.removeEventListener(
      "reader:articles-updated",
      this._onArticlesUpdated
    );
  }

  async _hydrateArticlesList() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const searchParams = new URLSearchParams(window.location.search);
    const filterFeedURL = searchParams.get("filter-feed-url");

    const feedSet = filterFeedURL
      ? new Set([filterFeedURL])
      : new Set(this._feedURLs);

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
