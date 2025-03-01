import { proxiedFetch } from "./utils/proxiedFetch.js";

const domParser = new DOMParser();

/**
 * @param {string} url
 *
 * @returns {Promise<{
 *  title: string | null;
 *  thumbnail: {
 *    url: string;
 *    alt: string;
 *    blob: Blob|null;
 *    width: number;
 *    height: number;
 *  } | null;
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
    ?.trim();

  if (ogTitleText) {
    title = ogTitleText;
  } else {
    const titleText = parsedDocument
      .querySelector("title")
      ?.textContent?.trim();
    if (titleText) {
      title = titleText;
    }
  }

  /**
   * @type {string | null}
   */
  let thumbnailURL = null;
  let thumbnailImageAlt = "";
  /**
   * @type {Blob | null}
   */
  let cachedThumbnailBlob = null;
  let thumbnailWidth = 0;
  let thumbnailHeight = 0;

  const ogImageURL = parsedDocument
    .querySelector("meta[property='og:image']")
    ?.getAttribute("content")
    ?.trim();

  if (ogImageURL && URL.canParse(ogImageURL)) {
    const blobResult = await proxiedFetch(ogImageURL, {
      method: "GET",
      headers: {
        "Content-Type": "image/*",
      },
    }).then((res) => {
      if (!res.ok) {
        console.error(
          `Unable to fetch thumbnail URL: received ${res.status} ${res.statusText} response from URL ${ogImageURL}`
        );
        return null;
      }

      return res.blob().then(async (blob) => {
        cachedThumbnailBlob = blob;
        /**
         * @type {number}
         */
        let timeoutID;
        let blobURL = URL.createObjectURL(blob);
        const imageDimensions =
          await /** @type {Promise<{ width: number; height: number; } | null>} */ (
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () => {
                resolve({
                  width: image.width,
                  height: image.height,
                });
              };
              image.onerror = () => {
                console.error("Error loading image");
                resolve(null);
              };
              image.src = blobURL;
              timeoutID = window.setTimeout(() => {
                console.error("Image load timeout");
                resolve(null);
              }, 5000);
            })
          ).finally(() => {
            URL.revokeObjectURL(blobURL);
            clearTimeout(timeoutID);
          });

        return {
          blob,
          width: imageDimensions?.width ?? 0,
          height: imageDimensions?.height ?? 0,
        };
      });
    });

    if (blobResult) {
      cachedThumbnailBlob = blobResult.blob;
      thumbnailWidth = blobResult.width;
      thumbnailHeight = blobResult.height;

      thumbnailURL = ogImageURL;
      thumbnailImageAlt =
        parsedDocument
          .querySelector("meta[property='og:image:alt']")
          ?.getAttribute("content")
          ?.trim() ?? "";
    }
  }

  return {
    title,
    thumbnail: thumbnailURL
      ? {
          url: thumbnailURL,
          alt: thumbnailImageAlt,
          blob: cachedThumbnailBlob,
          width: thumbnailWidth,
          height: thumbnailHeight,
        }
      : null,
  };
}
