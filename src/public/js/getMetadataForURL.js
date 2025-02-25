import { proxiedFetch } from "./utils/proxiedFetch.js";

const domParser = new DOMParser();

/**
 * @param {string} url
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

  if (!response.body) {
    console.error("Response has no body");
    return null;
  }

  let html = "";

  const stream = response.body.pipeThrough(new TextDecoderStream());

  for await (const chunk of stream) {
    const endOfHeadIndex = chunk.indexOf("</head");
    if (endOfHeadIndex >= 0) {
      // If we reached the end of the head, we can stop reading the response body
      html += chunk.slice(0, endOfHeadIndex);
      break;
    }

    html += chunk;
  }

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

  const thumbnailImageAlt =
    parsedDocument
      .querySelector("meta[property='og:image:alt']")
      ?.getAttribute("content")
      .trim() ?? "";

  return {
    title,
    thumbnail: {
      url: thumbnailURL,
      alt: thumbnailImageAlt,
    },
  };
}
