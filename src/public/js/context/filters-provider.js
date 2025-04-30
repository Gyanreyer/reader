import { LitElement, ContextProvider, html, css } from "/lib/lit.js";
import { filtersContext } from "./filtersContext.js";
import { settings } from "../settings.js";

/**
 * @import {FiltersContextValue} from './filtersContext.js';}
 */

export default class FiltersProvider extends LitElement {
  static tagName = "filters-provider";

  static styles = css`
    :host {
      display: contents;
    }
  `;

  constructor() {
    super();

    /**
     * @type {typeof filtersContext.__context__}
     */
    this._contextValue = {
      includeUnread: true,
      includeRead: true,
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
