import { proxiedFetch } from "./utils/proxiedFetch.mjs";

const domParser = new DOMParser();

/**
 * @param {string} url
 * @returns {Promise<{
 *  title: string,
 *  thumbnailURL: string,
 * } | null>}
 */
export async function getMetadataForURL(url) {
  const response = await proxiedFetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "text/html",
    },
  });
  if (!response.ok) {
    console.error(
      `Unable to fetch URL: received ${response.status} ${response.statusText} response from URL ${url}`
    );
    return null;
  }

  const html = await response.text();

  const parsedDocument = domParser.parseFromString(html, "text/html");

  /**
   * @type {string | null}
   */
  let title = null;

  const ogTitleText = parsedDocument
    .querySelector("meta[property='og:title']")
    ?.getAttribute("content")
    .trim();

  if (ogTitleText) {
    title = ogTitleText;
  } else {
    const titleText = parsedDocument.querySelector("title")?.textContent.trim();
    if (titleText) {
      title = titleText;
    }
  }

  /**
   * @type {string | null}
   */
  let thumbnailURL = null;

  const ogImageURL = parsedDocument
    .querySelector("meta[property='og:image']")
    ?.getAttribute("content")
    .trim();

  if (ogImageURL && URL.canParse(ogImageURL)) {
    thumbnailURL = ogImageURL;
  }

  return null;
}
