import { db } from "./db.mjs";

const SETTINGS_KEYS = /**
 * @type {const}
 */ ({
  ARTICLE_REFRESH_INTERVAL: "articleRefreshInterval",
  FILTER__INCLUDE_UNREAD: "filter_IncludeUnread",
  FILTER__INCLUDE_READ: "filter_IncludeRead",
});

/**
 * @typedef {typeof SETTINGS_KEYS[keyof typeof SETTINGS_KEYS]} SettingsKey
 */

/**
 * Maps setting keys to the expected type for their values.
 *
 * @typedef {{
 *  [SETTINGS_KEYS.ARTICLE_REFRESH_INTERVAL]: number;
 *  [SETTINGS_KEYS.FILTER__INCLUDE_UNREAD]: boolean;
 *  [SETTINGS_KEYS.FILTER__INCLUDE_READ]: boolean;
 * }} SettingsValues
 */

/**
 * @satisfies {{
 *  [key in SettingsKey]: any;
 * }}
 */
const SETTINGS_DEFAULTS = /** @type {const} */ ({
  [SETTINGS_KEYS.ARTICLE_REFRESH_INTERVAL]: 120 * 60 * 1000, // 2 hours
  [SETTINGS_KEYS.FILTER__INCLUDE_UNREAD]: true,
  [SETTINGS_KEYS.FILTER__INCLUDE_READ]: false,
});

export const settings = {
  /**
   * @template {SettingsKey} T
   * @param {T} name
   * @returns {Promise<SettingsValues[T]>}
   */
  async get(name) {
    const setting = await db.settings.get(name);
    return /** @type any */ (setting?.value ?? SETTINGS_DEFAULTS[name]);
  },
  /**
   * @param {SettingsKey} name
   * @param {SettingsValues[SettingsKey]} value
   */
  async set(name, value) {
    await db.settings.put({ name, value });
  },
};
