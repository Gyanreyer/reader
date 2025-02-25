import { css, html, LitElement } from "/lib/lit.js";
import { db } from "/js/db.js";

/**
 * @import { Feed } from '/js/db.js';
 */

export class FeedsList extends LitElement {
  static get properties() {
    return {
      _feeds: {
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
     * @type {Feed[]}
     */
    this._feeds = [];

    this._onFeedsUpdated = async () => {
      this._feeds = await db.feeds.orderBy("title").toArray();
    };
    window.addEventListener("reader:feeds-updated", this._onFeedsUpdated);
    this._onFeedsUpdated();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener("reader:feeds-updated", this._onFeedsUpdated);
  }

  render() {
    return html`
      <ul>
        <a href="?">All</a>
        ${this._feeds?.map(
          (feed) =>
            html`<li>
              <a href=${`?filter-feed-url=${encodeURIComponent(feed.url)}`}
                >${feed.title}</a
              >
            </li>`
        ) ?? ""}
      </ul>
    `;
  }

  static {
    customElements.define("feeds-list", FeedsList);
  }
}
