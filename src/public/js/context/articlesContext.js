import { createContext } from "/lib/lit.js";

/**
 * @import { DiscoveredDay } from '../articleBatches.js';
 */

/**
 * @typedef {{
 *  days: DiscoveredDay[]; // The discovered days loaded so far, newest first
 *  isLoadingArticles: boolean;
 *  hasMoreArticles: boolean; // Whether there are older days left to load
 *  isRefreshing: boolean;
 *  refreshProgress: number;
 *  areArticlesStale: boolean;
 * }} ArticlesContextValue
 */

/**
 * @type {ReturnType<typeof createContext<ArticlesContextValue>>}
 */
export const articlesContext = createContext("articles");
