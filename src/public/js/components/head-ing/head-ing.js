import { ContextConsumer, css, html, LitElement } from "/lib/lit.js";

import { db } from "/js/db.js";
import { articlesContext } from "/js/context/articlesContext.js";

import "./refresh-progress-bar.js";
import "./filter-modal.js";

export class Heading extends LitElement {
  static properties = {
    _listHeaderText: {
      state: true,
    },
  };

  static styles = css`
    :host {
      display: block;
    }

    #filters-button {
      position: fixed;
      inset-block-start: 1rem;
      inset-inline-end: 1rem;
      z-index: 1;
    }

    header {
      position: relative;
      padding-block: 3rem 1.5rem;
      padding-inline: 1.5rem 1rem;
      background: var(--clr-accent);
      color: white;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    header h1 {
      margin: 0;
    }

    refresh-progress-bar {
      position: absolute;
      inset-block-start: 0;
      inset-inline: 0;
      z-index: 1;
    }
  `;

  constructor() {
    super();

    const filterFeedURL = new URLSearchParams(window.location.search).get(
      "filter-feed-url"
    );

    /**
     * @type {string | null}
     */
    this._listHeaderText = "All Articles";
    if (filterFeedURL) {
      this._listHeaderText = null;
      db.feeds.get(filterFeedURL).then((feed) => {
        if (feed) {
          this._listHeaderText = `Articles from ${feed.title}`;
        }
      });
    }

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: (newValue) => {
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  onClickRefreshArticles() {
    window.dispatchEvent(new CustomEvent("reader:refresh-article-list"));
  }

  render() {
    return html`<header>
      <refresh-progress-bar></refresh-progress-bar>
      <h1>${this._listHeaderText}</h1>
      <filter-modal></filter-modal>
    </header>`;
  }

  static {
    customElements.define("head-ing", Heading);
  }
}
