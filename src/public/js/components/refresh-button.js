import { articlesContext } from "/js/context/articlesContext.js";
import { LitElement, html, css, ContextConsumer } from "/lib/lit.js";

/**
 * @import ArticlesProvider from "/js/context/articles-provider.js";
 */

export default class RefreshButton extends LitElement {
  static tagName = "refresh-button";

  static styles = css`
    :host {
      display: flex;
      justify-content: center;

      visibility: hidden;
      transition: visibility 0.2s allow-discrete;
    }

    :host([data-active]) {
      visibility: visible;
    }

    button {
      /** Use absolute position so this button doesn't affect the height of the container */
      position: absolute;
      width: max-content;
      font-size: 1.1rem;
      background-color: var(--clr-light);
      border: 1.5px solid currentColor;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      padding: 0.4rem 1.2rem;
      margin-block-start: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      cursor: pointer;
      opacity: 0;
      transform: translateY(-20%);
      transition-property: opacity, transform;
      transition-duration: inherit;
    }

    :host([data-active]) button {
      opacity: 1;
      transform: none;

      &:active {
        transform: scale(0.97);
      }
    }
  `;

  constructor() {
    super();

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: ({ areArticlesStale }) => {
        this.requestUpdate();
        this.toggleAttribute("data-active", areArticlesStale);
      },
      subscribe: true,
    });
  }

  /**
   * @type {ArticlesProvider|null}
   */
  _cachedArticlesProvider = null;
  _getArticlesProvider() {
    return (this._cachedArticlesProvider ??=
      document.querySelector("articles-provider"));
  }

  _refresh() {
    this._getArticlesProvider()?.updateArticlesList();
  }

  render() {
    return html`
      <button id="refresh-button" @click="${this._refresh}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/icons.svg#refresh"></use>
        </svg>
        New articles available
      </button>
    `;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
