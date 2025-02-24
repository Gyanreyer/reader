import { css, html, LitElement } from "/lib/lit.mjs";

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
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
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
      use[href$="#hamburger-menu"] {
      display: none;
    }

    :host(:not([data-expanded]))
      #toggle-menu-button
      svg
      use[href$="#left-arrow"] {
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
          <use href="/spritesheet.svg#hamburger-menu"></use>
          <use href="/spritesheet.svg#left-arrow"></use>
        </svg>
      </button>
      <slot></slot>
    `;
  }

  /**
 *       <button @click=${this._toggleCollapse} id="close-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>
      </button>
 */

  static {
    customElements.define("side-bar", SideBar);
  }
}
