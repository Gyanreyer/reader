import { filtersContext } from "/js/context/filtersContext.js";
import { LitElement, html, css, ContextConsumer } from "/lib/lit.js";

/**
 * @import { FiltersProvider} from '/js/context/filters-provider.js';
 */

export class FilterModal extends LitElement {
  static styles = css`
    #filters-button {
      border-radius: 8px;
      padding: 0.2rem;
      cursor: pointer;
      border: none;
      border: 1px solid currentColor;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.3);
    }

    #filters-button svg {
      display: block;
    }

    dialog {
      display: none;
      padding: 2rem 1rem 3rem;
      flex-direction: column;
      gap: 0.5rem;
      width: min(90%, 24rem);
      border-radius: 8px;
    }

    dialog:popover-open {
      display: flex;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }

    dialog h2 {
      margin: 0;
    }
  `;

  constructor() {
    super();

    this._filtersContextConsumer = new ContextConsumer(this, {
      context: filtersContext,
      callback: () => {
        this.requestUpdate();
      },
      subscribe: true,
    });
  }

  /**
   * @type {FiltersProvider|null}
   */
  _cachedFiltersProvider = null;
  _getFiltersProvider() {
    return (this._cachedFiltersProvider ??=
      document.querySelector("filters-provider"));
  }

  /**
   * @param {Event} evt
   */
  toggleIncludeRead(evt) {
    const filtersProvider = this._getFiltersProvider();
    const inputElement = evt.target;
    if (filtersProvider && inputElement instanceof HTMLInputElement) {
      filtersProvider.setIncludeRead(inputElement.checked);
    }
  }

  /**
   * @param {Event} evt
   */
  toggleIncludeUnread(evt) {
    const filtersProvider = this._getFiltersProvider();
    const inputElement = evt.target;
    if (filtersProvider && inputElement instanceof HTMLInputElement) {
      filtersProvider.setIncludeUnread(inputElement.checked);
    }
  }

  render() {
    const filterContextValue = this._filtersContextConsumer.value;
    if (!filterContextValue) {
      return null;
    }

    const { includeRead, includeUnread } = filterContextValue;

    return html`
      <button popovertarget="filters-popover" id="filters-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <use href="/icons.svg#filter"></use>
        </svg>
      </button>
      <dialog popover id="filters-popover">
        <h2>Filters</h2>
        <label>
          Include unread
          <input
            type="checkbox"
            id="filter-include-unread"
            ?checked="${includeUnread}"
            @change="${this.toggleIncludeUnread}"
          />
        </label>
        <label>
          Include read
          <input
            type="checkbox"
            id="filter-include-read"
            ?checked="${includeRead}"
            @change="${this.toggleIncludeRead}"
          />
        </label>
      </dialog>
    `;
  }

  static {
    customElements.define("filter-modal", FilterModal);
  }
}
