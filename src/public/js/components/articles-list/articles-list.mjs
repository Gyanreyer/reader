import { css, html, LitElement } from "/lib/lit-core.mjs";
import { liveQuery } from "/lib/dexie.mjs";
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

    const articleURLsObservable = liveQuery(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return db.articles
        .orderBy("publishedAt")
        .desc()
        .limit(100)
        .filter(
          (article) =>
            article.readAt === null || article.readAt > fiveMinutesAgo
        )
        .primaryKeys();
    });

    articleURLsObservable.subscribe({
      next: (articles) => {
        this._articleURLs = articles;
      },
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
