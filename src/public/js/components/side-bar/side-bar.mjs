import { css, html, LitElement } from "/lib/lit-core.mjs";

export class SideBar extends LitElement {
  static properties = {
    isCollapsed: {
      attribute: "data-collapsed",
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
      transition: transform 0.2s;
    }

    #sidebar-collapse-button {
      position: absolute;
      top: 50%;
      left: 100%;
      transform: translate(-50%, -50%);
      transition: transform 0.2s;
    }

    #sidebar-collapse-button svg {
      transition: transform 0.2s;
    }

    :host([data-collapsed]) {
      transform: translateX(-100%);

      & #sidebar-collapse-button {
        transform: translate(-25%, -50%);
      }
      & #sidebar-collapse-button svg {
        transform: scaleX(-1);
      }
    }
  `;

  constructor() {
    super();

    // this.isCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
  }

  _toggleCollapse() {
    console.log("toggle", this.isCollapsed);
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      localStorage.setItem("sidebar-collapsed", "true");
    } else {
      localStorage.removeItem("sidebar-collapsed");
    }
  }

  render() {
    return html`<slot></slot
      ><button @click=${this._toggleCollapse} id="sidebar-collapse-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/spritesheet.svg#left-arrow"></use>
        </svg>
      </button>`;
  }

  static {
    customElements.define("side-bar", SideBar);
  }
}
