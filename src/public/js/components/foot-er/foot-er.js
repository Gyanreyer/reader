import { css, html, LitElement } from "/lib/lit.js";

import { db } from "/js/db.js";
import { ArticlesList } from "../articles-list/articles-list.js";

export class Footer extends LitElement {
  static properties = {
    _listHeaderText: {
      state: true,
    },
    _totalArticleCount: {
      attribute: "total-article-count",
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
      padding-block: 3rem 1.5rem;
      padding-inline: 2rem;
      background: var(--clr-accent);
      color: white;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.5);
    }

    header h1 {
      margin: 0;
    }
  `;

  _totalArticleCount = 0;

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
          this.requestUpdate();
        }
      });
    }
  }

  render() {
    const searchParams = new URLSearchParams(window.location.search);

    const currentPageNumber = Number(searchParams.get("page")) || 1;

    const nextPageParams = new URLSearchParams(searchParams);
    nextPageParams.set("page", String(currentPageNumber + 1));

    const previousPageParams = new URLSearchParams(searchParams);
    previousPageParams.set("page", String(currentPageNumber - 1));
    const hasPreviousPage = currentPageNumber > 1;
    const hasNextPage =
      this._totalArticleCount > currentPageNumber * ArticlesList.PAGE_SIZE;

    return html`<footer>
      <div>
        ${hasPreviousPage
          ? html`<a href="?${previousPageParams.toString()}">Previous page</a>`
          : null}
        ${hasNextPage
          ? html`<a href="?${nextPageParams.toString()}">Next page</a>`
          : null}
      </div>
      ;
    </footer>`;
  }

  static {
    customElements.define("foot-er", Footer);
  }
}
