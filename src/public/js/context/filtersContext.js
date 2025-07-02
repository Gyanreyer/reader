import { createContext } from "/lib/lit.js";

/**
 * @typedef {{
 *  includeUnread: boolean;
 *  includeRead: boolean;
 *  pageNumber: number;
 *  pageSize: number;
 * }} FiltersContextValue
 */

/**
 * @type {ReturnType<typeof createContext<FiltersContextValue>>}
 */
export const filtersContext = createContext("filters");
