import { articlesContext } from "/js/context/articlesContext.js";
import { LitElement, html, css, ContextConsumer } from "/lib/lit.js";

export default class RefreshProgressBar extends LitElement {
  static tagName = "refresh-progress-bar";

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      width: 100%;
      z-index: 1;
      block-size: 0.4rem;
      background-color: var(--clr-light);
      display: none;
      transform: scaleY(0);
      transform-origin: top center;
      transition-property: transform, display;
      transition-duration: 0.4s;
      transition-delay: 0.6s;
      transition-behavior: allow-discrete;
    }

    :host([data-active]) {
      display: block;
      transform: scaleY(1);
      transition-delay: 0s;
    }

    div[role="progressbar"] {
      position: absolute;
      inset: 0;
      background-color: var(--clr-positive-action);
      transform: scaleX(var(--progress));
      transform-origin: center;
      transition: transform 0.4s;
    }
  `;

  constructor() {
    super();

    this.toggleAttribute("data-active", false);

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: (newContextValue) => {
        this.toggleAttribute("data-active", newContextValue.isRefreshing);
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  render() {
    const { refreshProgress = 0 } = this._articlesContextConsumer.value ?? {};

    return html`<div
      aria-label="Refreshing articles for feeds"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="0"
      aria-valuenow="${refreshProgress}"
      style="--progress: ${refreshProgress}"
    ></div>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
