import { css, html, LitElement } from "/lib/lit.js";

export class SideBar extends LitElement {
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
    }

    @media screen and (max-width: 600px) {
      :host {
        position: fixed;
        inset-block-start: 0;
        inset-inline-start: 0;
        height: auto;
      }
    }

    dialog {
      inset-block-start: 0;
      inset-inline-start: 0;
      width: min(18rem, 80vw);
      height: 100vh;
      margin: unset;
      max-width: unset;
      max-height: unset;
      padding: 0;
      overflow: hidden;
      flex-direction: column;
      background-color: var(--clr-light);
      opacity: 0;
      transform: translateX(-100%);
      transition: opacity, transform, display allow-discrete,
        overlay allow-discrete;
      transition-duration: 0.2s;
    }

    dialog[open] {
      display: flex;
      opacity: 1;
      transform: translateX(0);
      transition: opacity 0.2s, transform 0.2s;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      opacity: 0;
      transition: opacity, display allow-discrete;
      transition-duration: 0.2s;
    }

    dialog[open]::backdrop {
      opacity: 1;
    }

    @starting-style {
      dialog[open] {
        opacity: 0;
        transform: translateX(-100%);
      }

      dialog[open]::backdrop {
        opacity: 0;
      }
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
    return html`
      ${this._isMobile
        ? html`<button
              @click="${
                /**
                 * @param {*} evt
                 */
                (evt) => evt.currentTarget.nextElementSibling.showModal()
              }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                <use href="/icons.svg#hamburger-menu"></use>
              </svg>
            </button>
            <dialog>
              <form method="dialog">
                <button id="toggle-menu-button" type="">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                  >
                    <use href="/icons.svg#left-arrow"></use>
                  </svg>
                </button>
              </form>
              <slot></slot>
            </dialog>`
        : html`<slot></slot>`}
    `;
  }

  static {
    customElements.define("side-bar", SideBar);
  }
}
