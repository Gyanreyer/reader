import { css, html, LitElement } from "/lib/lit.js";

export class SideBar extends LitElement {
  static properties = {
    isExpanded: {
      attribute: "data-expanded",
      type: Boolean,
      reflect: true,
    },
  };

  static styles = css`
    :host {
      width: min(18rem, 30vw);
      height: 100vh;
    }

    #backdrop {
      display: none;
    }

    @media screen and (max-width: 600px) {
      :host {
        width: min(18rem, 80vw);
        position: absolute;
        transform: translateX(-100%);
        visibility: hidden;
        transition-property: transform, opacity, visibility;
        transition-duration: 0.2s;
      }
      :host([data-expanded]) {
        transform: none;
        visibility: visible;
        transition-duration: 0.2s, 0.2s, 0s;
      }

      :host([data-expanded]) #backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: -1;
      }
    }

    #toggle-menu-button {
      position: absolute;
      inset-block-start: 1rem;
      inset-inline-start: calc(100% + 1rem);
      visibility: visible;
      transition: transform 0.2s;
    }

    :host([data-expanded]) #toggle-menu-button {
      transform: translateX(calc(-50% - 1rem));
    }

    :host([data-expanded])
      #toggle-menu-button
      svg
      use[href="/icons.svg#hamburger-menu"] {
      display: none;
    }

    :host(:not([data-expanded]))
      #toggle-menu-button
      svg
      use[href="/icons.svg#left-arrow"] {
      display: none;
    }

    #close-button {
      margin-inline-start: auto;
    }
  `;

  constructor() {
    super();

    this.isExpanded = localStorage.getItem("sidebar-expanded") === "true";
  }

  _toggleCollapse() {
    this.isExpanded = !this.isExpanded;
    localStorage.setItem("sidebar-expanded", String(this.isExpanded));
  }

  render() {
    return html`
      <button @click=${this._toggleCollapse} id="toggle-menu-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/icons.svg#hamburger-menu"></use>
          <use href="/icons.svg#left-arrow"></use>
        </svg>
      </button>
      <slot></slot>
      <div id="backdrop"></div>
    `;
  }

  static {
    customElements.define("side-bar", SideBar);
  }
}
