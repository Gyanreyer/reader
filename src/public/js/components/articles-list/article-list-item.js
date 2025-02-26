import { css, html, LitElement } from "/lib/lit.js";
import { liveQuery } from "/lib/dexie.js";
import { db } from "/js/db.js";
import { getMetadataForURL } from "../../getMetadataForURL.js";

/**
 * @import { Article } from '/js/db.js';
 */

const NO_THUMBNAIL = "NO_THUMBNAIL";

export class ArticleListItem extends LitElement {
  static properties = {
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

  static styles = css`
    article {
      --menu-button-size: 1.5rem;
      --inline-padding: 0.75rem;
      padding-block: 1rem;
      padding-inline-start: var(--inline-padding);
      padding-inline-end: calc(var(--menu-button-size) + var(--inline-padding));
      background: bisque;
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    article[data-read="true"] {
      opacity: 0.7;
    }

    #thumbnail {
      display: block;
      max-width: min(100%, 420px);
      margin-block-end: 0.25rem;
      border-radius: 4px;
    }

    article h2 {
      margin: 0;
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
      width: var(--menu-button-size);
    }

    button[popovertarget="menu-popover"] svg {
      width: 100%;
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
     * @type {string}
     */
    this.url = "";

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

    this._articleSubscription = liveQuery(() =>
      db.articles.get(this.url)
    ).subscribe((article) => {
      if (
        article &&
        (!this._article || this._article.feedURL !== article.feedURL)
      ) {
        db.feeds.get(article.feedURL).then((feed) => {
          this._feedTitle = feed.title;
        });
      }
      this._article = article;
    });
  }

  connectedCallback() {
    super.connectedCallback();

    ArticleListItem.intersectionObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._articleSubscription.unsubscribe();
    ArticleListItem.intersectionObserver.unobserve(this);
  }

  _onClickArticleLink() {
    // Mark the article as read
    db.articles.update(this._article.url, {
      read: 1,
    });
  }

  _onClickToggleRead() {
    db.articles.update(this._article.url, {
      read: /** @type {0 | 1} */ (this._article.read ^ 1),
    });
  }

  willUpdate(changedProperties) {
    super.willUpdate(changedProperties);
    if (
      (changedProperties.has("isVisible") ||
        changedProperties.has("_article")) &&
      this.isVisible &&
      this._article
    ) {
      if (this._article.thumbnail === null) {
        getMetadataForURL(this._article.url).then((metadata) => {
          db.articles.update(this._article.url, {
            thumbnail: metadata?.thumbnail ?? NO_THUMBNAIL,
          });
        });
      }
    }
  }

  render() {
    if (!this._article) {
      return;
    }

    const { url, title, thumbnail, publishedAt, read } = this._article;

    return html`<article data-read="${read === 1}">
      ${thumbnail && thumbnail !== NO_THUMBNAIL
        ? html`<img
            id="thumbnail"
            src="${thumbnail.url}"
            alt="${thumbnail.alt}"
            loading="lazy"
            onerror="this.style.display = 'none'"
          />`
        : null}
      <h2>
        <a href="${url}" target="_blank" @click="${this._onClickArticleLink}"
          >${title}</a
        >
      </h2>
      <p>${this._feedTitle}</p>
      <p>${new Date(publishedAt).toLocaleString()}</p>
      <button aria-label="Actions" popovertarget="menu-popover">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/spritesheet.svg#menu-dots"></use>
        </svg>
      </button>
      <div popover id="menu-popover">
        <button @click=${this._onClickToggleRead} id="toggle-read">
          Mark as ${read === 1 ? "unread" : "read"}
        </button>
      </div>
    </article>`;
  }

  static {
    customElements.define("article-list-item", ArticleListItem);
  }
}
