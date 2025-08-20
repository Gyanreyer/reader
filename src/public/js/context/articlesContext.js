import { createContext } from "/lib/lit.js";

/**
 * @typedef {{
 *  articleURLs: Array<({
 *    feedURL: string;
 *    feedTitle: string;
 *    articleURLs: string[];
 *  }) | string>;
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
