import { css, html, LitElement } from "/lib/lit.js";

export default class SideBar extends LitElement {
  static tagName = "side-bar";

  static properties = {
    _isMobile: {
      attribute: "data-mobile",
      type: Boolean,
      Reflect: true,
    },
  };

  static styles = css`
    :host {
      max-width: min(18rem, 30vw);
      height: 100vh;
      background-color: var(--clr-light);
      display: flex;
      flex-direction: column;
      position: relative;
    }

    @media screen and (max-width: 600px) {
      :host(:not(:popover-open)) {
        display: none;
        opacity: 0;
        transform: translateX(-100%);
      }

      :host {
        position: fixed;
        inset-block-start: 0;
        inset-inline-start: 0;
        height: 100vh;
        width: min(18rem, 80vw);
        margin: unset;
        max-width: unset;
        max-height: unset;
        transition: opacity, transform, display allow-discrete,
          overlay allow-discrete;
        transition-duration: 0.2s;
      }

      :host::backdrop {
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        opacity: 1;
        transition: opacity, display allow-discrete;
        transition-duration: 0.2s;
      }

      :host:not(:popover-open)::backdrop {
        display: none;
        opacity: 0;
      }

      @starting-style {
        :host(:popover-open) {
          opacity: 0;
          transform: translateX(-100%);
        }

        :host::backdrop {
          opacity: 0;
        }
      }
    }

    dialog {
      padding: 0;
      overflow: hidden;
      flex-direction: column;
      background-color: var(--clr-light);
    }

    dialog[open] {
      display: flex;
      opacity: 1;
      transform: translateX(0);
      transition: opacity 0.2s, transform 0.2s;
    }

    #close-button {
      margin-inline-start: auto;
    }
  `;

  constructor() {
    super();

    /**
     * @param {MediaQueryListEvent} event
     */
    this._onMobileQueryChanged = (event) => {
      this._isMobile = event.matches;
    };

    this._mobileQuery = window.matchMedia("(max-width: 600px)");
    this._mobileQuery.addEventListener("change", this._onMobileQueryChanged);
    this._isMobile = this._mobileQuery.matches;
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this._mobileQuery.removeEventListener("change", this._onMobileQueryChanged);
  }

  render() {
    return html`<slot></slot>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
