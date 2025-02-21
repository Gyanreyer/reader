import { db } from "./db.mjs";

const SETTINGS_KEYS = /**
 * @type {const}
 */ ({
  ARTICLE_REFRESH_INTERVAL: "articleRefreshInterval",
});

/**
 * @typedef {typeof SETTINGS_KEYS[keyof typeof SETTINGS_KEYS]} SettingsKey
 */

/**
 * Maps setting keys to the expected type for their values.
 *
 * @typedef {{
 *  [SETTINGS_KEYS.ARTICLE_REFRESH_INTERVAL]: number;
 * }} SettingsValues
 */

/**
 * @type {{
 *  [key in SettingsKey]: any;
 * }}
 */
const SETTINGS_DEFAULTS = {
  [SETTINGS_KEYS.ARTICLE_REFRESH_INTERVAL]: 120 * 60 * 1000, // 2 hours
};

export const settings = {
  /**
   * @param {SettingsKey} name
   * @returns {Promise<SettingsValues[SettingsKey]>}
   */
  async get(name) {
    const setting = await db.settings.get(name);
    return setting?.value ?? SETTINGS_DEFAULTS[name];
  },
  /**
   * @param {SettingsKey} name
   * @param {SettingsValues[SettingsKey]} value
   */
  async set(name, value) {
    await db.settings.put({ name, value });
  },
};
