import { articlesContext } from "/js/context/articlesContext.js";
import { LitElement, html, css, ContextConsumer } from "/lib/lit.js";

/**
 * @import ArticlesProvider from "/js/context/articles-provider.js";
 */

/**
 * Scrolls back to the top and starts a Refresh. It expands to "New articles" when a background Refresh finds
 * new articles, and shows progress while a Refresh is running.
 *
 * It sits in the main header's nav on desktop, and floats in the bottom corner on mobile.
 */
export default class RefreshButton extends LitElement {
  static tagName = "refresh-button";

  static styles = css`
    :host {
      position: fixed;
      inset-block-end: calc(1rem + env(safe-area-inset-bottom, 0px));
      inset-inline-end: calc(1rem + env(safe-area-inset-right, 0px));
      z-index: 2;
    }

    @media screen and (min-width: 600px) {
      :host {
        position: static;
      }
    }

    button {
      --progress: 0;
      --progress-ring-color: var(--clr-positive-action);

      position: relative;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.6rem;
      border: 1px solid currentColor;
      border-radius: 999px;
      background-color: var(--clr-light);
      color: var(--clr-dark);
      font: inherit;
      font-weight: bold;
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.35);
      cursor: pointer;
    }

    @media screen and (min-width: 600px) {
      button {
        /** Match the filter button next to it */
        padding: 0.2rem;
        border-radius: 8px;
        box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.3);
      }
    }

    button:active {
      transform: scale(0.97);
    }

    :host([data-has-new-articles]) button {
      padding-inline-end: 0.9rem;
      background-color: var(--clr-positive-action);
      border-color: var(--clr-positive-action);
      color: white;
      --progress-ring-color: white;
    }

    svg {
      display: block;
    }

    .icon {
      position: relative;
    }

    /** A ring around the icon that fills up as the Refresh progresses */
    :host([data-refreshing]) .icon::before {
      content: "";
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      background: conic-gradient(
        var(--progress-ring-color) calc(var(--progress) * 1turn),
        color-mix(in srgb, currentColor 15%, transparent) 0
      );
      mask: radial-gradient(
        farthest-side,
        transparent calc(100% - 3px),
        black calc(100% - 2.5px)
      );
    }

    :host([data-refreshing]) .icon svg {
      animation: spin 1s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      :host([data-refreshing]) .icon svg {
        animation: none;
      }
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

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
  `;

  constructor() {
    super();

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: ({ areArticlesStale, isRefreshing }) => {
        this.toggleAttribute("data-has-new-articles", areArticlesStale);
        this.toggleAttribute("data-refreshing", isRefreshing);
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  /**
   * @type {ArticlesProvider|null}
   */
  _cachedArticlesProvider = null;
  _getArticlesProvider() {
    return (this._cachedArticlesProvider ??=
      document.querySelector("articles-provider"));
  }

  _onClick() {
    this._getArticlesProvider()?.refresh();
  }

  render() {
    const {
      areArticlesStale = false,
      isRefreshing = false,
      refreshProgress = 0,
    } = this._articlesContextConsumer.value ?? {};

    return html`
      <button
        @click="${this._onClick}"
        style="--progress: ${refreshProgress}"
        title="Scroll to top and refresh"
      >
        <span class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" aria-hidden="true">
            <use href="/icons.svg#refresh"></use>
          </svg>
        </span>
        ${areArticlesStale
          ? html`New articles`
          : html`<span class="sr-only"
              >${isRefreshing ? "Refreshing articles" : "Scroll to top and refresh"}</span
            >`}
      </button>
    `;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
