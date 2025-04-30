import { css, html, LitElement, repeat, ContextConsumer } from "/lib/lit.js";

import { articlesContext } from "/js/context/articlesContext.js";

import "./article-list-item.js";

export default class ArticlesList extends LitElement {
  static tagName = "articles-list";

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
      padding: 0;
      margin: 0;
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
    const articlesContextValue = this._articlesContextConsumer.value;

    if (!articlesContextValue) {
      return null;
    }

    const { articleURLs, isLoadingArticles } = articlesContextValue;

    if (articleURLs.length === 0 && !isLoadingArticles) {
      return html`<p class="no-articles-msg">No articles found.</p>`;
    }

    return html`
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
    customElements.define(this.tagName, this);
  }
}
