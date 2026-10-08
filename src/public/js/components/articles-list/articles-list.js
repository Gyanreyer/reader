import { css, html, LitElement, repeat, ContextConsumer } from "/lib/lit.js";

import { articlesContext } from "/js/context/articlesContext.js";

import { getDayLabel } from "/js/utils/getDayLabel.js";

import "./article-list-item.js";

/**
 * @import { ArticlesContextValue } from '/js/context/articlesContext.js';
 * @import { FeedGroup } from '/js/articleBatches.js';
 * @import ArticlesProvider from '/js/context/articles-provider.js';
 */

// Matches the breakpoint in index.webc where <main> becomes the scroll container
const DESKTOP_MEDIA_QUERY = "screen and (min-width: 600px)";

export default class ArticlesList extends LitElement {
  static tagName = "articles-list";

  static styles = css`
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .day + .day {
      margin-block-start: 0.75rem;
    }

    .day-header {
      /** Sticks below the main header, which is only sticky on desktop (see index.webc) */
      position: sticky;
      inset-block-start: var(--day-header-top, 0px);
      z-index: 1;
      margin: 0 -1rem 0.5rem;
      padding: 0.5rem 1rem;
      font-size: 1rem;
      background-color: var(--clr-bg);
    }

    #list-status {
      margin-block: 1.5rem 0.5rem;
      text-align: center;
      opacity: 0.75;
    }

    #list-status:empty {
      display: none;
    }

    .article-list-item-group {
      background-color: var(--clr-light);
      border-radius: 0.5rem;
      padding: 1rem;
      opacity: 0.75;
      transition: opacity 0.1s;
    }

    .article-list-item-group:has([data-read="false"]) {
      opacity: 1;
    }
    
    .article-list-item-group summary {
      cursor: pointer;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .article-list-item-group summary p {
      font-size: 0.875rem;
      margin-block: 0;
      margin-inline-start: auto;
      white-space: nowrap;
    }

    .article-list-item-group summary:before {
      /** Right black arrow */
      content: '\\25B8';
      font-size: 1.5rem;
      line-height: 1;
    }

    .article-list-item-group[open] summary:before {
      /** Down black arrow */
      content: '\\25BE';
    }

    .article-list-item-group ul {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .article-list-item-group h3 {
      margin: 0;
      font-size: inherit;
      color: var(--clr-text);
      display: inline;
    }
  `;

  constructor() {
    super();

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: () => {
        this.requestUpdate();
      },
      subscribe: true,
    });

    // Above 600px <main> is the scroll container; below it, the window scrolls
    this._desktopMediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    this._onDesktopMediaQueryChange = () => this._observeSentinel();

    /**
     * @type {IntersectionObserver | null}
     */
    this._sentinelObserver = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._desktopMediaQuery.addEventListener(
      "change",
      this._onDesktopMediaQueryChange
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._desktopMediaQuery.removeEventListener(
      "change",
      this._onDesktopMediaQueryChange
    );
    this._sentinelObserver?.disconnect();
    this._sentinelObserver = null;
  }

  firstUpdated() {
    this._observeSentinel();
  }

  updated() {
    // If a batch didn't fill the screen, the sentinel never leaves it, so the observer won't report it again.
    // Observing it again makes the observer report its current visibility once the new articles are laid out.
    const sentinel = this.renderRoot.querySelector("#sentinel");
    if (sentinel && this._sentinelObserver) {
      this._sentinelObserver.unobserve(sentinel);
      this._sentinelObserver.observe(sentinel);
    }
  }

  /**
   * Watches the sentinel at the end of the list, so we can start loading the next batch about one screen early.
   * An observer's root can't be changed, so it's recreated whenever the scroll container changes.
   */
  _observeSentinel() {
    this._sentinelObserver?.disconnect();

    const sentinel = this.renderRoot.querySelector("#sentinel");
    if (!sentinel) {
      return;
    }

    this._sentinelObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this._loadMore();
        }
      },
      {
        root: this._desktopMediaQuery.matches
          ? document.querySelector("main")
          : null,
        rootMargin: "100% 0px",
      }
    );
    this._sentinelObserver.observe(sentinel);
  }

  _loadMore() {
    const articlesContextValue = this._articlesContextConsumer.value;
    if (
      articlesContextValue &&
      !articlesContextValue.isLoadingArticles &&
      articlesContextValue.hasMoreArticles
    ) {
      this._getArticlesProvider()?.loadMoreArticles();
    }
  }

  /**
   * @type {ArticlesProvider|null}
   */
  _cachedArticlesProvider = null;
  _getArticlesProvider() {
    return (this._cachedArticlesProvider ??=
      document.querySelector("articles-provider"));
  }

  /**
   * @param {FeedGroup | string} item
   */
  _renderItem(item) {
    if (typeof item === "string") {
      return html`<li>
        <article-list-item url=${item}></article-list-item>
      </li>`;
    }

    return html`<li>
      <details open class="article-list-item-group">
        <summary>
          <h3>${item.feedTitle}</h3>
          <p>${item.articleURLs.length} articles</p>
        </summary>
        <ul>
          ${item.articleURLs.map(
            (url) =>
              html`<li>
                <article-list-item url=${url} data-compact></article-list-item>
              </li>`
          )}
        </ul>
      </details>
    </li>`;
  }

  /**
   * @param {ArticlesContextValue} articlesContextValue
   */
  _renderStatus({ days, isLoadingArticles, hasMoreArticles }) {
    if (isLoadingArticles) {
      return "Loading articles…";
    }
    if (!hasMoreArticles) {
      return days.length > 0 ? "That's everything." : "No articles found.";
    }
    return "";
  }

  render() {
    const articlesContextValue = this._articlesContextConsumer.value;

    // The sentinel is always rendered so the observer always has something to watch
    return html`
      ${repeat(
        articlesContextValue?.days ?? [],
        (day) => day.start,
        (day) => html`<section class="day">
          <h2 class="day-header">${getDayLabel(day.start)}</h2>
          <ul>
            ${repeat(
              day.items,
              (item) =>
                typeof item === "string"
                  ? `article/${item}`
                  : `group/${item.feedURL}/${item.articleURLs.join("-")}`,
              (item) => this._renderItem(item)
            )}
          </ul>
        </section>`
      )}
      <div id="sentinel"></div>
      <p id="list-status" role="status">${articlesContextValue
        ? this._renderStatus(articlesContextValue)
        : ""}</p>
    `;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
