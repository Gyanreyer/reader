import { css, html, LitElement } from "/lib/lit-core.mjs";
import { db } from "/js/db.mjs";

/**
 * @type {{
 *  url: string;
 *  title: string;
 * }} Feed
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
  }

  connectedCallback() {
    super.connectedCallback();

    db.feeds
      .orderBy("title")
      .toArray()
      .then((feeds) => {
        this._feeds = feeds;
      });
  }

  render() {
    return html`
      <ul>
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
