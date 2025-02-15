import { css, html, LitElement } from "/lib/lit-core.mjs";
import { liveQuery } from "/lib/dexie.mjs";
import { db } from "/js/db.mjs";
import { getMetadataForURL } from "../../getMetadataForURL.mjs";

/**
 * @typedef {{
 *  url: string;
 *  title: string;
 *  thumbnailURL: string | null;
 *  publishedAt: number;
 *  readAt: number | null;
 * }} Article
 */

const NO_THUMBNAIL = "NO_THUMBNAIL";

export class ArticleListItem extends LitElement {
  static get properties() {
    return {
      url: {
        type: String,
      },
      _article: {
        state: true,
      },
      _feedTitle: {
        state: true,
      },
      isVisible: {
        state: true,
      },
    };
  }

  static styles = css`
    article {
      padding: 0.5rem 1rem;
      background: bisque;
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    article *:focus {
      outline: 2px solid blue;
    }

    article h2 {
      margin: 0 0 0.5rem;
    }

    article img {
      max-width: 50vw;
      max-height: 25vh;
      border-radius: 4px;
      object-fit: contain;
      object-position: left;
    }

    article p {
      margin: 0;
      font-size: 0.9rem;
    }

    button[popovertarget="menu-popover"] {
      position: absolute;
      padding: 0;
      inset-block-start: 0.5rem;
      inset-inline-end: 0.5rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      border: 1px solid black;
    }

    button[popovertarget="menu-popover"] svg {
      width: 1.5rem;
      height: auto;
    }
  `;

  static intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target instanceof ArticleListItem) {
          if (entry.isIntersecting) {
            entry.target.isVisible = true;
            ArticleListItem.intersectionObserver.unobserve(entry.target);
          }
        }
      }
    },
    {
      rootMargin: "120px",
    }
  );

  constructor() {
    super();

    /**
     * @type {Article | null}
     */
    this._article = null;
    /**
     * @type {string | null}
     */
    this._feedTitle = null;

    /**
     * @type {string | null}
     */
    this._feedTitle = null;

    this.isVisible = false;

    this._articleSubscription = null;
  }

  connectedCallback() {
    super.connectedCallback();

    ArticleListItem.intersectionObserver.observe(this);

    this._articleSubscription = liveQuery(() =>
      db.articles.get(this.url)
    ).subscribe({
      next: (article) => {
        if (
          article &&
          (!this._article || this._article.feedURL !== article.feedURL)
        ) {
          db.feeds.get(article.feedURL).then((feed) => {
            this._feedTitle = feed.title;
            this.requestUpdate();
          });
        }
        this._article = article;
        this.requestUpdate();
      },
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._articleSubscription.unsubscribe();
    ArticleListItem.intersectionObserver.unobserve(this);
  }

  _onClickArticleLink() {
    // Mark the article as read
    db.articles.update(this._article.url, {
      readAt: Date.now(),
    });
  }

  _onClickMarkUnread() {
    // Mark the article as unread
    db.articles.update(this._article.url, {
      readAt: null,
    });
  }

  willUpdate(changedProperties) {
    if (
      (changedProperties.has("isVisible") ||
        changedProperties.has("_article")) &&
      this.isVisible &&
      this._article
    ) {
      if (this._article.thumbnailURL === null) {
        getMetadataForURL(this._article.url).then((metadata) => {
          db.articles.update(this._article.url, {
            thumbnailURL: metadata?.thumbnailURL ?? NO_THUMBNAIL,
          });
        });
      }
    }
  }

  render() {
    if (!this._article) {
      return null;
    }

    const { url, title, thumbnailURL, publishedAt, readAt } = this._article;

    return html`<article>
      <h2>
        <a href="${url}" target="_blank" @click="${this._onClickArticleLink}"
          >${title}</a
        >
      </h2>
      ${thumbnailURL && thumbnailURL !== NO_THUMBNAIL
        ? html`<img src="${thumbnailURL}" alt="" loading="lazy" />`
        : null}
      <p>${this._feedTitle}</p>
      <p>${new Date(publishedAt).toLocaleString()}</p>
      <button popovertarget="menu-popover">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/spritesheet.svg#menu-dots"></use>
        </svg>
      </button>
      <div popover id="menu-popover">
        ${readAt
          ? html`<button @click=${this._onClickMarkUnread} id="mark-unread">
              Mark unread
            </button>`
          : null}
      </div>
    </article>`;
  }

  static {
    customElements.define("article-list-item", ArticleListItem);
  }
}
