import { css, html, LitElement, repeat, ContextConsumer } from "/lib/lit.js";

import { articlesContext } from "/js/context/articlesContext.js";

import "./article-list-item.js";
import "./refresh-button.js";

export class ArticlesList extends LitElement {
  static PAGE_SIZE = 48;

  static get properties() {
    return {
      _articleURLs: {
        state: true,
      },
      _filter_IncludeUnread: {
        state: true,
      },
      _includeRead: {
        state: true,
      },
    };
  }

  static styles = css`
    ul {
      list-style-type: none;
      padding-inline: 1rem;
      margin-block-start: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    refresh-button {
      position: sticky;
      inset-block-start: 0rem;
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
  }

  render() {
    const { articleURLs = [] } = this._articlesContextConsumer.value ?? {};

    return html`
      <refresh-button></refresh-button>
      <ul>
        ${repeat(
          articleURLs,
          (url) => url,
          (url) =>
            html`<li>
              <article-list-item url=${url}></article-list-item>
            </li>`
        )}
      </ul>
    `;
  }

  static {
    customElements.define("articles-list", ArticlesList);
  }
}
