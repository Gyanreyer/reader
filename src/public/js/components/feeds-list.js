import { css, html, LitElement } from "/lib/lit.js";
import { db } from "/js/db.js";

/**
 * @import { Feed } from '/js/db.js';
 */

export default class FeedsList extends LitElement {
  static tagName = "feeds-list";

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

    li a {
      color: var(--clr-positive-action);
      font-weight: 600;
    }

    li a[aria-current="page"] {
      color: var(--clr-accent);
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
    const currentFeedURL = new URLSearchParams(window.location.search).get(
      "filter-feed-url"
    );

    return html`
      <ul>
        <li>
          <a href="?" aria-current=${!currentFeedURL ? "page" : "false"}>All</a>
        </li>
        ${this._feeds?.map((feed) => {
          return html`<li>
            <a
              href=${`?filter-feed-url=${encodeURIComponent(feed.url)}`}
              aria-current=${currentFeedURL === feed.url ? "page" : "false"}
            >
              ${feed.title}
            </a>
          </li>`;
        }) ?? ""}
      </ul>
    `;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
