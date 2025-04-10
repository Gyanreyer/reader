import { ContextConsumer, css, html, LitElement } from "/lib/lit.js";

import { db } from "/js/db.js";
import { articlesContext } from "/js/context/articlesContext.js";

import "./refresh-progress-bar.js";

export class Heading extends LitElement {
  static properties = {
    _listHeaderText: {
      state: true,
    },
  };

  static styles = css`
    #filters-button {
      position: fixed;
      inset-block-start: 1rem;
      inset-inline-end: 1rem;
      z-index: 1;
    }

    header {
      position: relative;
      padding-block: 3rem 1.5rem;
      padding-inline: 2rem;
      background: var(--clr-accent);
      color: white;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.5);
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
    const { areArticlesStale } = this._articlesContextConsumer.value ?? {};

    return html`<header>
      <refresh-progress-bar></refresh-progress-bar>
      <h1>${this._listHeaderText}</h1>
      ${areArticlesStale
        ? html`<button @click="${this.onClickRefreshArticles}">
            New articles available
          </button>`
        : null}
    </header>`;
  }

  static {
    customElements.define("head-ing", Heading);
  }
}

/**
 *       <!--
      <button
        aria-label="Filter settings"
        popovertarget="filters-popover"
        id="filters-button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/icons.svg#filter"></use>
        </svg>
      </button>
      <div popover id="filters-popover">
        <label>
          Include unread
          <input
            type="checkbox"
            id="filter-include-unread"
            ?checked="${settings.get("filter_IncludeUnread")}"
            @change="${
        (event) => settings.set("filter_IncludeUnread", event.target.checked)
      }"
          />
        </label>
        ${this._filter_IncludeRead !== null
        ? html`<label>
            Include read
            <input
              type="checkbox"
              id="filter-include-read"
              ?checked="${this._filter_IncludeRead}"
              @change="${
                (event) =>
                  settings.set("filter_IncludeRead", event.target.checked)
              }"
            />
          </label>`
        : null}
      </div>-->
 */
