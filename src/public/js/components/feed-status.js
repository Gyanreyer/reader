import { css, html, LitElement } from "/lib/lit.js";
import { db } from "/js/db.js";
import { getFilterFeedURL } from "/js/utils/getFilterFeedURL.js";

/**
 * @import { Feed } from '/js/db.js';
 */

/**
 * In the single-feed view, explains why the feed is dead or where it has moved to.
 */
export default class FeedStatus extends LitElement {
  static tagName = "feed-status";

  static properties = {
    _feed: {
      state: true,
    },
  };

  static styles = css`
    p {
      margin-block: 0 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      background-color: var(--clr-light);
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.3);
      overflow-wrap: anywhere;
    }

    strong {
      color: var(--clr-negative-action);
    }
  `;

  constructor() {
    super();

    /**
     * @type {Feed | null}
     */
    this._feed = null;

    this._onFeedsUpdated = async () => {
      const filterFeedURL = getFilterFeedURL();
      this._feed = filterFeedURL
        ? (await db.feeds.get(filterFeedURL)) ?? null
        : null;
    };
    window.addEventListener("reader:feeds-updated", this._onFeedsUpdated);
    this._onFeedsUpdated();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener("reader:feeds-updated", this._onFeedsUpdated);
  }

  render() {
    if (!this._feed) {
      return null;
    }

    const { deadReason, movedTo } = this._feed;

    return html`
      ${deadReason
        ? html`<p>
            <strong>This feed is dead and won't be fetched again.</strong>
            ${deadReason}.
          </p>`
        : null}
      ${movedTo
        ? html`<p>
            <strong>This feed has moved</strong> to ${movedTo}. Update its URL
            in feeds.yml.
          </p>`
        : null}
    `;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
