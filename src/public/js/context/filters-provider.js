import { LitElement, ContextProvider, html, css } from "/lib/lit.js";
import { filtersContext } from "./filtersContext.js";
import { settings } from "../settings.js";
import { addHistoryChangeEventListener } from "../history.js";

/**
 * @import {FiltersContextValue} from './filtersContext.js';}
 */

const getPageNumber = () =>
  Number(new URLSearchParams(window.location.search).get("page")) || 1;

export default class FiltersProvider extends LitElement {
  static tagName = "filters-provider";

  static styles = css`
    :host {
      display: contents;
    }
  `;

  static PAGE_SIZE = 20;

  constructor() {
    super();

    /**
     * @type {typeof filtersContext.__context__}
     */
    this._contextValue = {
      includeUnread: true,
      includeRead: false,
      pageNumber: getPageNumber(),
      pageSize: FiltersProvider.PAGE_SIZE,
    };
    this._provider = new ContextProvider(this, {
      context: filtersContext,
      initialValue: this._contextValue,
    });

    Promise.all([
      settings.get("filter_IncludeRead"),
      settings.get("filter_IncludeUnread"),
    ]).then(([includeRead, includeUnread]) => {
      this._updateContextValue({
        includeRead,
        includeUnread,
      });
    });

    addHistoryChangeEventListener(() => {
      const pageNumber = getPageNumber();
      if (pageNumber !== this._contextValue.pageNumber) {
        this._updateContextValue({
          pageNumber,
        });
      }
    });
  }

  /**
   * @param {Partial<FiltersContextValue>} updatedContextValue
   */
  _updateContextValue(updatedContextValue) {
    this._contextValue = {
      ...this._contextValue,
      ...updatedContextValue,
    };

    this._provider.setValue(this._contextValue);
  }

  /**
   *
   * @param {boolean} includeRead
   */
  setIncludeRead(includeRead) {
    settings.set("filter_IncludeRead", includeRead);
    this._updateContextValue({
      includeRead,
    });
  }

  /**
   *
   * @param {boolean} includeUnread
   */
  setIncludeUnread(includeUnread) {
    settings.set("filter_IncludeUnread", includeUnread);
    this._updateContextValue({
      includeUnread,
    });
  }

  render() {
    return html`<slot></slot>`;
  }

  static {
    customElements.define(this.tagName, this);
  }
}
