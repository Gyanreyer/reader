import { db } from "../db.js";
import { css, html, LitElement } from "/lib/lit.js";

export default class HeaderTitle extends LitElement {
  static tagName = "header-title";

  static styles = css`
    :host {
      display: contents;
    }

    h1 {
      margin: 0;
    }
  `;

  constructor() {
    super();

    const filterFeedURL = new URLSearchParams(window.location.search).get(
      "filter-feed-url"
    );

    this._title = "All Articles";

    if (filterFeedURL) {
      this._title = "Articles from...";
      db.feeds.get(filterFeedURL).then((feed) => {
        if (feed) {
          this._title = `Articles from ${feed.title}`;
        } else {
          this._title = "Feed not found";
        }
        this.requestUpdate();
      });
    }
  }

  render() {
    return html`<h1>${this._title}</h1>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
