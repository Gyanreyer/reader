import { createContext } from "/lib/lit.js";

/**
 * @typedef {{
 *  articleURLs: string[];
 *  isLoadingArticles: boolean;
 *  totalArticleCount: number;
 *  isRefreshing: boolean;
 *  refreshProgress: number;
 *  areArticlesStale: boolean;
 * }} ArticlesContextValue
 */

/**
 * @type {ReturnType<typeof createContext<ArticlesContextValue>>}
 */
export const articlesContext = createContext("articles");
