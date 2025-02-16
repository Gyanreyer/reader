import { css, html, LitElement } from "/lib/lit-core.mjs";
import { db } from "/js/db.mjs";

import "./article-list-item.mjs";

export class ArticlesList extends LitElement {
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
  }

  connectedCallback() {
    super.connectedCallback();
    this._refreshArticlesQuery();
  }

  _refreshArticlesQuery() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const searchParams = new URLSearchParams(window.location.search);
    const filterFeedURL = searchParams.get("filter-feed-url");

    db.articles
      .orderBy("publishedAt")
      .desc()
      .filter(
        (article) =>
          (filterFeedURL ? article.feedURL === filterFeedURL : true) &&
          (article.readAt === null || article.readAt > fiveMinutesAgo)
      )
      .limit(100)
      .primaryKeys()
      .then((urls) => {
        this._articleURLs = urls;
      });
  }

  render() {
    return html`
      <ul>
        ${this._articleURLs?.map(
          (url) =>
            html`<li>
              <article-list-item url=${url}></article-list-item>
            </li>`
        ) ?? ""}
      </ul>
    `;
  }

  static {
    customElements.define("articles-list", ArticlesList);
  }
}
