import { html, LitElement } from "/lib/lit-core.mjs";
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

class ArticlesList extends LitElement {
  static {
    customElements.define("articles-list", ArticlesList);
  }

  static get properties() {
    return {
      _articles: {
        state: true,
      },
    };
  }

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

  render() {
    return html`
      <ul>
        ${this._articles?.map(
          (article) => html`<li>
            <a href="${article.url}" target="article-frame">
              ${article.thumbnailURL
                ? html`<img src="${article.thumbnailURL}" alt="" />`
                : html`<div>No image</div>`}
              ${article.title}
              <div>Feed: ${article.feedTitle}</div>
              <div>
                Published at: ${new Date(article.publishedAt).toLocaleString()}
              </div>
            </a>
          </li>`
        ) ?? ""}
      </ul>
    `;
  }
}
