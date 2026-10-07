import { db } from "./db.js";
import { enqueueForHost, getHostKey } from "./utils/hostQueue.js";
import { parseRetryAfter } from "./utils/parseRetryAfter.js";
import { proxiedFetch } from "./utils/proxiedFetch.js";

const domParser = new DOMParser();

/**
 * Returned when the article's host is refusing or failing requests, so the article should be tried again later.
 */
export const HOST_UNAVAILABLE = "HOST_UNAVAILABLE";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

// Titles of bot challenge pages which some hosts serve instead of the article
const CHALLENGE_PAGE_TITLES = new Set([
  "Just a moment...",
  "Attention Required! | Cloudflare",
  "Making sure you're not a bot!",
]);

/**
 * @typedef {{
 *  title: string | null;
 *  thumbnail: {
 *    url: string;
 *    alt: string;
 *  } | null;
 * }} URLMetadata
 */

/**
 * @param {string} url
 * @param {number} retryAfter
 * @param {string} reason
 */
async function recordHostFailure(url, retryAfter, reason) {
  console.warn(
    `Not fetching pages from ${getHostKey(url)} until ${new Date(retryAfter).toLocaleString()}: ${reason}`
  );
  await db.hostFailures.put({
    host: getHostKey(url),
    retryAfter,
    reason,
  });
}

/**
 * @param {string} url
 * @returns {Promise<URLMetadata | null | typeof HOST_UNAVAILABLE>}
 */
async function fetchMetadataForURL(url) {
  const hostFailure = await db.hostFailures.get(getHostKey(url));
  if (hostFailure && hostFailure.retryAfter > Date.now()) {
    return HOST_UNAVAILABLE;
  }

  let response;
  try {
    response = await proxiedFetch(url, {
      method: "GET",
    });
  } catch (e) {
    // This is most likely a problem with our own connection rather than the host, so don't hold it against them
    console.error(`Failed to fetch URL ${url}`, e);
    return HOST_UNAVAILABLE;
  }

  const responseDescription = `${response.status} ${response.statusText}`.trim();

  if (response.headers.get("cf-mitigated") === "challenge") {
    response.body?.cancel();
    await recordHostFailure(
      url,
      Date.now() + ONE_WEEK,
      `Received a challenge page (${responseDescription})`
    );
    return HOST_UNAVAILABLE;
  }

  if (response.status === 429 || response.status === 503) {
    response.body?.cancel();
    await recordHostFailure(
      url,
      parseRetryAfter(response.headers.get("Retry-After")) ??
        Date.now() + ONE_DAY,
      responseDescription
    );
    return HOST_UNAVAILABLE;
  }

  if (response.status === 403) {
    response.body?.cancel();
    await recordHostFailure(url, Date.now() + ONE_WEEK, responseDescription);
    return HOST_UNAVAILABLE;
  }

  if (response.status >= 500) {
    response.body?.cancel();
    await recordHostFailure(url, Date.now() + ONE_DAY, responseDescription);
    return HOST_UNAVAILABLE;
  }

  if (!response.ok) {
    // Other errors like a 404 are specific to this article, not the host
    response.body?.cancel();
    console.error(
      `Unable to fetch URL: received ${responseDescription} response from URL ${url}`
    );
    return null;
  }

  // The proxy only returns the page's <head>
  const html = await response.text();

  const parsedDocument = domParser.parseFromString(html, "text/html");

  const titleText = parsedDocument.querySelector("title")?.textContent?.trim();

  if (titleText && CHALLENGE_PAGE_TITLES.has(titleText)) {
    await recordHostFailure(
      url,
      Date.now() + ONE_WEEK,
      `Received a challenge page titled "${titleText}" (${responseDescription})`
    );
    return HOST_UNAVAILABLE;
  }

  /**
   * @type {string | null}
   */
  let title = null;

  const ogTitleText = parsedDocument
    .querySelector("meta[property='og:title']")
    ?.getAttribute("content")
    ?.trim();

  if (ogTitleText) {
    title = ogTitleText;
  } else if (titleText) {
    title = titleText;
  }

  /**
   * @type {string | null}
   */
  let thumbnailURL = null;

  const ogImageURL = parsedDocument
    .querySelector("meta[property='og:image']")
    ?.getAttribute("content")
    ?.trim();

  if (ogImageURL && URL.canParse(ogImageURL, url)) {
    thumbnailURL = ogImageURL;
  }

  const thumbnailImageAlt =
    parsedDocument
      .querySelector("meta[property='og:image:alt']")
      ?.getAttribute("content")
      ?.trim() ?? "";

  return {
    title,
    thumbnail: thumbnailURL
      ? {
        url: thumbnailURL,
        alt: thumbnailImageAlt,
      }
      : null,
  };
}

/**
 * Fetches currently in progress, so an article which re-renders while its fetch is pending doesn't fetch again.
 *
 * @type {Map<string, Promise<URLMetadata | null | typeof HOST_UNAVAILABLE>>}
 */
const pendingFetches = new Map();

/**
 * Fetches the metadata from an article page's <head>. Only one page is fetched from each host at a time.
 *
 * @param {string} url
 * @returns {Promise<URLMetadata | null | typeof HOST_UNAVAILABLE>} The page's metadata, null if the page has none,
 *  or HOST_UNAVAILABLE if the host is refusing or failing requests and the page should be tried again later.
 */
export function getMetadataForURL(url) {
  let pendingFetch = pendingFetches.get(url);
  if (!pendingFetch) {
    pendingFetch = enqueueForHost(url, () => fetchMetadataForURL(url)).finally(
      () => pendingFetches.delete(url)
    );
    pendingFetches.set(url, pendingFetch);
  }
  return pendingFetch;
}
