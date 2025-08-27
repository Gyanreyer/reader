import { css, html, LitElement, repeat, ContextConsumer } from "/lib/lit.js";

import { articlesContext } from "/js/context/articlesContext.js";

import "./article-list-item.js";

export default class ArticlesList extends LitElement {
  static tagName = "articles-list";

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

    .article-list-item-group {
      background-color: var(--clr-light);
      border-radius: 0.5rem;
      padding: 1rem;
      opacity: 0.75;
      transition: opacity 0.1s;
    }

    .article-list-item-group:has([data-read="false"]) {
      opacity: 1;
    }
    
    .article-list-item-group summary {
      cursor: pointer;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .article-list-item-group summary p {
      font-size: 0.875rem;
      margin-block: 0;
      margin-inline-start: auto;
      white-space: nowrap;
    }

    .article-list-item-group summary:before {
      /** Right black arrow */
      content: '\\25B8';
      font-size: 1.5rem;
      line-height: 1;
    }

    .article-list-item-group[open] summary:before {
      /** Down black arrow */
      content: '\\25BE';
    }

    .article-list-item-group ul {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .article-list-item-group h3 {
      margin: 0;
      font-size: inherit;
      color: var(--clr-text);
      display: inline;
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
        ${repeat(articleURLs,
      (articleURLsOrGroup) => typeof articleURLsOrGroup === "string" ? `article/${articleURLsOrGroup}` : `group/${articleURLsOrGroup.feedURL}/${articleURLsOrGroup.articleURLs.join("-")}`,
      (articleURLOrGroup) =>
        html`<li>
          ${typeof articleURLOrGroup === "string" ?
            html`<article-list-item url=${articleURLOrGroup}></article-list-item>` :
            html`<details open class="article-list-item-group">
              <summary>
                <h3>${articleURLOrGroup.feedTitle}</h3>
                <p>${articleURLOrGroup.articleURLs.length} articles</p>
              </summary>
              <ul>
                ${articleURLOrGroup.articleURLs.map(
              (url) =>
                html`<li><article-list-item url=${url} data-compact></article-list-item></li>`
            )}
              </ul>
            </details>`}
        </li>`
    )}
      </ul>
    `;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
