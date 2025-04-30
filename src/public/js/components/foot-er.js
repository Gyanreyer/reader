import { ContextConsumer, css, html, LitElement } from "/lib/lit.js";

import { articlesContext } from "../context/articlesContext.js";

export default class Footer extends LitElement {
  static tagName = "foot-er";

  static styles = css``;

  constructor() {
    super();

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: () => {
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  render() {
    const articlesContextValue = this._articlesContextConsumer.value;
    if (!articlesContextValue) {
      return null;
    }

    const { pageNumber, totalArticleCount, pageSize } = articlesContextValue;

    const totalPageCount = Math.ceil(totalArticleCount / pageSize);

    const hasPreviousPage = pageNumber > 1;
    const hasNextPage = pageNumber < totalPageCount;

    const otherPageParams = new URLSearchParams(window.location.search);
    otherPageParams.delete("page");

    return html`<footer>
      <div>
        ${hasPreviousPage
          ? html`<a href="?${otherPageParams}&page=${pageNumber - 1}"
              >Previous page</a
            >`
          : null}
        ${hasNextPage
          ? html`<a href="?${otherPageParams}&page=${pageNumber + 1}"
              >Next page</a
            >`
          : null}
      </div>
    </footer>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
