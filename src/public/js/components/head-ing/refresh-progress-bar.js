import { LitElement, html, css } from "/lib/lit.js";

export class RefreshProgressBar extends LitElement {
  static properties = {
    _totalFeedCount: { state: true },
    _refreshedFeedCount: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      position: relative;
      z-index: 1;
      visibility: hidden;
      opacity: 0;
      block-size: 0.4rem;
      background-color: var(--clr-light);
      transform: scaleY(0);
      transform-origin: top center;
      transition: opacity 0.2s, transform 0.2s, visibility 0s;
      transition-delay: 0.2s, 0.2s, 0.4s;
    }

    :host([data-active]) {
      visibility: visible;
      opacity: 1;
      transform: scaleY(1);
      transition-delay: 0s;
    }

    div[role="progressbar"] {
      position: absolute;
      inset: 0;
      background-color: var(--clr-positive-action);
      transform: scaleX(var(--progress));
      transform-origin: left center;
      transition: transform 0.2s;
    }
  `;

  constructor() {
    super();

    this._totalFeedCount = 1;
    this._refreshedFeedCount = 0;

    /**
     *
     * @param {CustomEvent<{feedCount: number}>} evt
     */
    this.onArticlesRefreshStart = (evt) => {
      this._totalFeedCount = evt.detail.feedCount;
      this._refreshedFeedCount = 0;
      this.dataset.active = "";
    };
    window.addEventListener(
      "reader:articles-refresh-started",
      /** @type {any} */ (this.onArticlesRefreshStart)
    );

    this.onFeedRefreshed = () => {
      this._refreshedFeedCount += 1;
    };
    window.addEventListener(
      "reader:articles-refreshed-feed",
      /** @type {any} */ (this.onFeedRefreshed)
    );

    this.onArticlesRefreshCompleted = () => {
      delete this.dataset.active;
    };
    window.addEventListener(
      "reader:articles-refresh-complete",
      this.onArticlesRefreshCompleted
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(
      "reader:articles-refresh-started",
      /** @type {any} */ (this.onArticlesRefreshStart)
    );
    window.removeEventListener(
      "reader:articles-refreshed-feed",
      this.onFeedRefreshed
    );
    window.removeEventListener(
      "reader:articles-refresh-complete",
      this.onArticlesRefreshCompleted
    );
  }

  render() {
    return html`<div
      aria-label="Refreshing articles for feeds"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="${this._totalFeedCount}"
      aria-valuenow="${this._refreshedFeedCount}"
      aria-valuetext="${this._refreshedFeedCount} of ${this
        ._totalFeedCount} feeds refreshed"
      style="--progress: ${Math.floor(
        (this._refreshedFeedCount / this._totalFeedCount) * 100
      ) / 100}"
    ></div>`;
  }

  static {
    customElements.define("refresh-progress-bar", RefreshProgressBar);
  }
}
