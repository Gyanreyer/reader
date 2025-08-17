import { css, html, LitElement } from "/lib/lit.js";
import { liveQuery } from "/lib/dexie.js";
import { db } from "/js/db.js";
import { getMetadataForURL } from "/js/getMetadataForURL.js";

import "../relative-date.js";

/**
 * @import { Article } from '/js/db.js';
 */

const NO_THUMBNAIL = "NO_THUMBNAIL";

export default class ArticleListItem extends LitElement {
  static tagName = "article-list-item";

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
    .sr-only {
      position: absolute;
      clip: rect(1px, 1px, 1px, 1px);
      padding: 0;
      border: 0;
      height: 1px;
      width: 1px;
      overflow: hidden;
      white-space: nowrap;
    }

    article {
      --menu-button-size: 1.5rem;
      --inline-padding: 0.75rem;
      padding: 1rem;
      background-color: var(--clr-light);
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.3);
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      height: 100%;
      box-sizing: border-box;
      justify-content: end;
      transition: opacity 0.1s;
    }

    article[data-read="true"] {
      opacity: 0.75;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      column-gap: 1rem;
      row-gap: 0.25rem;
      flex: 1;
    }

    header h2 {
      margin-block: 0;
      margin-inline-end: 0.5rem;
      grid-column: 1/ 3;
    }

    header:not([data-has-thumb="true"]) h2 {
      /** If we don't have a thumbnail, shift the title up to take the thumbnail's place in the grid */
      grid-row: 1 / 2;
      grid-column: 1 / 2;
    }

    header a {
      color: var(--clr-positive-action);
    }

    #toggle-read {
      margin-inline-start: auto;
      margin-block-end: auto;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      gap: 0.4rem;
      align-items: center;
      border-bottom: 1.5px solid currentColor;
      font-weight: bold;
      color: var(--clr-positive-action);
    }

    [data-read="true"] #toggle-read {
      color: var(--clr-negative-action);
    }

    [data-read="false"] #toggle-read {
      margin-inline-start: 2.2ch;
    }

    #toggle-read svg {
      /** Take the icon's height in a little; there's a lot of empty padding on the
       *  top and bottom of the icon which makes the button's alignment feel weird
       */
      width: 20px;
      height: auto;
      margin-block: -2px;
    }

    #icon--mark-read,
    #icon--mark-unread {
      display: none;
    }

    [data-read="false"] #icon--mark-read {
      display: block;
    }

    [data-read="true"] #icon--mark-unread {
      display: block;
    }

    #thumbnail {
      display: block;
      max-width: min(100%, 420px);
      max-height: 280px;
      border-radius: 4px;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.15);
    }

    article p {
      margin: 0;
      font-size: 0.9rem;
    }

    #article-info {
      display: grid;
      grid-template-columns: auto 1fr auto;
      column-gap: 0.2rem;
    }

    #author,
    #published-at {
      grid-column: 1 / 2;
    }

    #word-count,
    #reading-duration {
      grid-column: 3 / 4;
    }

    #author,
    #word-count {
      grid-row: 1 / 2;
    }

    #published-at,
    #reading-duration {
      grid-row: 2 / 3;
    }

    #article-info p {
      margin: 0;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    #article-info svg {
      height: auto;
      opacity: 0.75;
    }

    #word-count svg {
      width: 1.8em;
    }

    #reading-duration svg {
      width: 1.4em;
      margin-inline: 0.2em;
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
          if (feed) {
            this._feedTitle = feed.title;
          }
        });
      }
      this._article = article ?? null;
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
    if (!this._article) {
      return;
    }

    // Mark the article as read
    db.articles.update(this._article.url, {
      read: 1,
    });
  }

  _onClickToggleRead() {
    if (!this._article) {
      return;
    }

    db.articles.update(this._article.url, {
      read: this._article.read === 0 ? 1 : 0,
    });
  }

  /**
   * @param {Map<string, any>} changedProperties
   */
  willUpdate(changedProperties) {
    super.willUpdate(changedProperties);
    if (
      (changedProperties.has("isVisible") ||
        changedProperties.has("_article")) &&
      this.isVisible &&
      this._article
    ) {
      const article = this._article;
      if (article.thumbnail === null) {
        getMetadataForURL(article.url).then((metadata) => {
          db.articles.update(article.url, {
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

    const { url, title, thumbnail, wordCount, publishedAt, read } =
      this._article;

    const parsedPublishedAt = new Date(publishedAt);

    const estimatedReadingDurationMinutes = wordCount
      ? Math.ceil(wordCount / 200)
      : null;

    const hasThumbnail = thumbnail !== null && thumbnail !== NO_THUMBNAIL;

    return html`<article data-read="${read >= 1}">
      <header data-has-thumb="${hasThumbnail}">
        ${hasThumbnail
          ? html`<img
              id="thumbnail"
              src="${thumbnail.url}"
              alt="${thumbnail.alt}"
              loading="lazy"
              onerror="this.style.display = 'none'; this.parentElement.dataset.hasThumb = false"
            />`
          : null}
        <button @click=${this._onClickToggleRead} id="toggle-read">
          Mark as ${read >= 1 ? "unread" : "read"}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <use href="/icons.svg#visibility-on" id="icon--mark-read"></use>
            <use href="/icons.svg#visibility-off" id="icon--mark-unread"></use>
          </svg>
        </button>
        <h2>
          <a href="${url}" target="_blank" @click="${this._onClickArticleLink}"
            >${title}</a
          >
        </h2>
      </header>
      <div id="article-info">
        <p id="author">${this._feedTitle}</p>
        <p id="published-at">
          <span class="sr-only">Published</span>
          <time datetime="${parsedPublishedAt.toISOString()}"
            ><relative-date
              >${parsedPublishedAt.toLocaleString()}</relative-date
            ></time
          >
        </p>
        <p id="word-count">
          ${wordCount
            ? html`<svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                >
                  <use href="/icons.svg#words"></use>
                </svg>
                ${wordCount} words`
            : null}
        </p>
        <p id="reading-duration">
          ${estimatedReadingDurationMinutes
            ? html`<svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                >
                  <use href="/icons.svg#clock"></use>
                </svg>
                ${estimatedReadingDurationMinutes}
                minute${estimatedReadingDurationMinutes === 1 ? "" : "s"}`
            : null}
        </p>
      </div>
    </article>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
