import { createContext } from "/lib/lit.js";

/**
 * @typedef {{
 *  articleURLs: string[];
 *  totalArticleCount: number;
 *  areArticlesStale: boolean;
 *  pageNumber: number;
 *  pageSize: number;
 * }} ArticlesContextValue
 */

/**
 * @type {ReturnType<typeof createContext<ArticlesContextValue>>}
 */
export const articlesContext = createContext("articles");
