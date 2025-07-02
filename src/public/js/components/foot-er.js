import { ContextConsumer, css, html, LitElement } from "/lib/lit.js";

import { articlesContext } from "../context/articlesContext.js";
import { filtersContext } from "../context/filtersContext.js";
import { pushHistory } from "../history.js";

export default class Footer extends LitElement {
  static tagName = "foot-er";

  static styles = css`
    footer {
      margin-block-start: 1rem;
      display: flex;
      justify-content: space-between;
      column-gap: 4rem;
    }

    a {
      color: var(--clr-positive-action);
      background-color: var(--clr-light);
      padding: 4px 8px;
      border-radius: 8px;
    }
  `;

  constructor() {
    super();

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: () => {
        this.requestUpdate();
      },
      subscribe: true,
    });

    this._filtersContextConsumer = new ContextConsumer(this, {
      context: filtersContext,
      callback: () => {
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  /**
   * @param {Event} e
   */
  _onClickPageLink(e) {
    if (e.target instanceof HTMLAnchorElement) {
      const href = e.target.getAttribute("href");
      if (href) {
        e.preventDefault();
        pushHistory(href);
      }
    }
  }

  render() {
    const articlesContextValue = this._articlesContextConsumer.value;
    const filtersContextValue = this._filtersContextConsumer.value;
    if (!articlesContextValue || !filtersContextValue) {
      return null;
    }

    const { totalArticleCount } = articlesContextValue;
    const { pageNumber, pageSize } = filtersContextValue;

    const totalPageCount = Math.ceil(totalArticleCount / pageSize);

    const hasPreviousPage = pageNumber > 1;
    const hasNextPage = pageNumber < totalPageCount;

    const otherPageParams = new URLSearchParams(window.location.search);
    otherPageParams.delete("page");

    return html`<footer>
      ${hasPreviousPage
        ? html`<a
            href="?${otherPageParams}&page=${pageNumber - 1}"
            @click=${this._onClickPageLink}
            >&ShortLeftArrow; Previous page</a
          >`
        : null}
      ${hasNextPage
        ? html`<a
            href="?${otherPageParams}&page=${pageNumber + 1}"
            @click=${this._onClickPageLink}
            >Next page &ShortRightArrow;</a
          >`
        : null}
    </footer>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
