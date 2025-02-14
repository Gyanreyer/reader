import { css, html, LitElement } from "/lib/lit-core.mjs";
import { liveQuery } from "/lib/dexie.mjs";
import { db } from "/js/db.mjs";

/**
 * @typedef {{
 *  url: string;
 *  title: string;
 *  publishedAt: number;
 *  thumbnailURL: string | null;
 * }} Article
 */

export class ArticlesList extends LitElement {
  static get properties() {
    return {
      _articles: {
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

    article {
      padding: 0.5rem 1rem;
      background: bisque;
      border-radius: 0.5rem;
    }

    article h2 {
      margin: 0;
    }
  `;

  constructor() {
    super();

    this._articles = [];
  }

  connectedCallback() {
    super.connectedCallback();

    const articlesObservable = liveQuery(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return db.articles
        .orderBy("publishedAt")
        .desc()
        .limit(100)
        .filter(
          (article) =>
            article.readAt === null || article.readAt > fiveMinutesAgo
        )
        .toArray(async (articles) => {
          /**
           * @type {{
           *  [feedURL: string]: string;
           * }}
           */
          const feedTitlePromises = {};

          return Promise.all(
            articles.map(async (article) => {
              // Annotate each article with its feed title
              if (!(article.feedURL in feedTitlePromises)) {
                feedTitlePromises[article.feedURL] = db.feeds
                  .get(article.feedURL)
                  .then((feed) => feed.title)
                  .catch(() => "Unknown Feed");
              }
              article.feedTitle = await feedTitlePromises[article.feedURL];

              return article;
            })
          );
        });
    });

    articlesObservable.subscribe({
      next: (articles) => {
        this._articles = articles;
      },
    });
  }

  _onClickArticle(event) {
    const articleURL = event.currentTarget.href;
    if (!articleURL) {
      return;
    }

    // Mark the article as read
    db.articles.update(articleURL, {
      readAt: Date.now(),
    });
  }

  _onClickMarkUnread(event) {
    const articleURL =
      event.currentTarget.closest("article")?.dataset.articleUrl;
    if (!articleURL) {
      return;
    }

    // Mark the article as unread
    db.articles.update(articleURL, {
      readAt: null,
    });
  }

  render() {
    return html`
      <ul>
        ${this._articles?.map(
          (article) => html`<li>
            <article data-article-url="${article.url}">
              <h2><a href="${article.url}" target="_blank" @click="${
            this._onClickArticle
          }">${article.title}</a></h2>
                ${
                  article.thumbnailURL
                    ? html`<img src="${article.thumbnailURL}" alt="" />`
                    : null
                }
                <p>${article.feedTitle}</p>
                <p>${new Date(article.publishedAt).toLocaleString()}</p>
                ${
                  article.readAt
                    ? html`<button @click=${this._onClickMarkUnread}>
                        Mark unread
                      </button>`
                    : null
                }
              </a>
            </article>
          </li>`
        ) ?? ""}
      </ul>
    `;
  }

  static {
    customElements.define("articles-list", ArticlesList);
  }
}
