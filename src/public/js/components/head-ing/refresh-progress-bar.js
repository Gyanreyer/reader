import { articlesContext } from "/js/context/articlesContext.js";
import { LitElement, html, css, ContextConsumer } from "/lib/lit.js";

export class RefreshProgressBar extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      z-index: 1;
      block-size: 0.4rem;
      background-color: var(--clr-light);
      visibility: hidden;
      transform: scaleY(0);
      transform-origin: top center;
      --transition-duration: 0.5s;
      transition: transform var(--transition-duration), visibility 0s;
      transition-delay: var(--transition-duration),
        calc(var(--transition-duration) * 2);
    }

    :host([data-active]) {
      visibility: visible;
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

    this._articlesContextConsumer = new ContextConsumer(this, {
      context: articlesContext,
      callback: () => {
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  render() {
    const { refreshProgress = 0, isRefreshing = false } =
      this._articlesContextConsumer.value ?? {};

    this.toggleAttribute("data-active", isRefreshing);

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
    customElements.define("refresh-progress-bar", RefreshProgressBar);
  }
}
