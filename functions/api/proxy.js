/**
 * @import { PagesFunction } from '@cloudflare/workers-types';
 */

// Generated from feeds.yml by scripts/build-feeds.js, which runs before the Function is bundled
import feedURLs from "../../_site/feeds.json";

/**
 * Normalizes a hostname so that "www.example.com" and "example.com" are treated as the same host.
 *
 * @param {string} hostname
 */
const normalizeHostname = (hostname) => hostname.replace(/^www\./, "");

const allowedFeedURLs = new Set(feedURLs);

const allowedHostnames = new Set(
  feedURLs.flatMap((feedURL) =>
    URL.canParse(feedURL) ? [normalizeHostname(new URL(feedURL).hostname)] : []
  )
);

/**
 * The proxy only fetches subscribed feeds, or article pages on the same host as a subscribed feed.
 *
 * @param {string} proxyURL
 */
const isAllowedProxyURL = (proxyURL) => {
  if (allowedFeedURLs.has(proxyURL)) {
    return true;
  }

  if (!URL.canParse(proxyURL)) {
    return false;
  }

  const parsedProxyURL = new URL(proxyURL);

  return (
    (parsedProxyURL.protocol === "https:" ||
      parsedProxyURL.protocol === "http:") &&
    allowedHostnames.has(normalizeHostname(parsedProxyURL.hostname))
  );
};

// Stop reading an article page if we haven't found the end of its <head> after this many characters
const MAX_ARTICLE_HEAD_LENGTH = 512 * 1024;

const END_OF_HEAD_REGEX = /<\/head/i;

/**
 * Article pages are only fetched for the metadata in their <head>, so we stop reading at </head>
 * and cancel the rest of the download.
 *
 * @param {Response} response
 * @returns {Promise<Response>}
 */
const getArticleHeadResponse = async (response) => {
  if (!response.body) {
    return response;
  }

  let head = "";

  if (response.headers.get("Content-Type")?.includes("html")) {
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    while (head.length < MAX_ARTICLE_HEAD_LENGTH) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      // Start searching a little before the new chunk in case "</head" is split across chunks
      const searchStartIndex = Math.max(0, head.length - "</head".length);
      head += value;

      const endOfHeadIndex = head
        .slice(searchStartIndex)
        .search(END_OF_HEAD_REGEX);
      if (endOfHeadIndex >= 0) {
        head = head.slice(0, searchStartIndex + endOfHeadIndex);
        break;
      }
    }

    await reader.cancel().catch(() => {});
  } else {
    // There's no <head> to read in a non-HTML response
    await response.body.cancel().catch(() => {});
  }

  const headers = new Headers(response.headers);
  // The body has changed, so the original length and encoding no longer apply
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");

  return new Response(head, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const MAX_REDIRECTS = 10;

// Tells the client the URL that a proxied URL has permanently moved to
const PERMANENT_REDIRECT_HEADER = "X-Proxy-Permanent-Redirect";

// Cached responses have their Cache-Control replaced with the proxy cache's own, so the publisher's is kept here
const ORIGINAL_CACHE_CONTROL_HEADER = "X-Proxy-Original-Cache-Control";

/**
 * Fetches a request, following redirects ourselves so we can tell when a URL has permanently moved.
 *
 * @param {Request} proxyRequest
 * @returns {Promise<{ response: Response; permanentRedirectURL: string | null; }>}
 */
const fetchFollowingRedirects = async (proxyRequest) => {
  let currentRequest = proxyRequest;
  /**
   * @type {string | null}
   */
  let permanentRedirectURL = null;
  let isPermanentSoFar = true;

  for (let i = 0; i <= MAX_REDIRECTS; ++i) {
    const response = await fetch(currentRequest, { redirect: "manual" });

    const location = response.headers.get("Location");
    if (
      response.status < 300 ||
      response.status >= 400 ||
      response.status === 304 ||
      !location ||
      !URL.canParse(location, currentRequest.url)
    ) {
      return { response, permanentRedirectURL };
    }

    await response.body?.cancel();

    const redirectURL = new URL(location, currentRequest.url).toString();

    // The original URL has only permanently moved if every redirect up to this one was also permanent
    isPermanentSoFar &&= response.status === 301 || response.status === 308;
    if (isPermanentSoFar) {
      permanentRedirectURL = redirectURL;
    }

    currentRequest = new Request(redirectURL, currentRequest);
  }

  throw new Error(`Exceeded ${MAX_REDIRECTS} redirects`);
};

/**
 * @param {Request} proxyRequest
 * @param {Headers} responseHeaders
 * @returns {Promise<Response>}
 */
const getProxiedResponse = async (proxyRequest, responseHeaders) => {
  try {
    const { response: proxiedResponse, permanentRedirectURL } =
      await fetchFollowingRedirects(proxyRequest);

    if (permanentRedirectURL) {
      responseHeaders.set(PERMANENT_REDIRECT_HEADER, permanentRedirectURL);
    }

    if (proxiedResponse.ok) {
      const requestEtag = proxyRequest.headers.get("If-None-Match");

      // Some servers include an Etag/Last-Modified header but still return a full 200 response
      // even if the header indicates the resource is unchanged. In this case, we'll double-check
      // the headers to see if we can return a 304 response to the client and save some bandwidth.
      if (requestEtag && proxiedResponse.headers.get("Etag") === requestEtag) {
        proxiedResponse.body.cancel();
        return new Response(null, {
          status: 304,
          headers: responseHeaders,
        });
      }

      const requestIfModifiedSince =
        proxyRequest.headers.get("If-Modified-Since");

      if (requestIfModifiedSince) {
        const responseLastModified =
          proxiedResponse.headers.get("Last-Modified");
        if (
          responseLastModified &&
          new Date(responseLastModified).getTime() <=
            new Date(requestIfModifiedSince).getTime()
        ) {
          proxiedResponse.body.cancel();
          return new Response(null, {
            status: 304,
            headers: responseHeaders,
          });
        }
      }
    }

    proxiedResponse.headers.forEach((value, key) => {
      // Apply the proxied response headers to the responseHeaders object
      responseHeaders.append(key, value);
    });

    return new Response(proxiedResponse.body, {
      status: proxiedResponse.status,
      statusText: proxiedResponse.statusText,
      headers: responseHeaders,
    });
  } catch (e) {
    return new Response(`Failed to proxy request to ${proxyRequest.url}: ${e}`, {
      status: 500,
      headers: responseHeaders,
    });
  }
};

/**
 * @type {PagesFunction}
 */
export const onRequest = async (context) => {
  const responseHeaders = new Headers({
    "Access-Control-Allow-Origin": `https://${context.env.ALLOWED_ORIGIN}`,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET",
  });

  /**
   * @type {URL}
   */
  let requestURL;
  try {
    requestURL = new URL(context.request.url);
  } catch (e) {
    return new Response(
      `Failed to parse context request URL ${context.request.url}`,
      {
        // This shouldn't happen, so it's an internal server error
        status: 500,
        headers: responseHeaders,
      }
    );
  }

  if (context.request.method !== "GET") {
    return new Response(`Method ${context.request.method} is not allowed`, {
      status: 405,
      headers: responseHeaders,
    });
  }

  const proxyURL = requestURL.searchParams.get("url");
  if (!proxyURL) {
    return new Response(
      `No proxy URL param provided on request URL ${requestURL.toString()}`,
      {
        status: 400,
        headers: responseHeaders,
      }
    );
  }

  if (!isAllowedProxyURL(proxyURL)) {
    return new Response(`Proxying ${proxyURL} is not allowed`, {
      status: 403,
      headers: responseHeaders,
    });
  }

  const cache = await caches.open("proxy-cache");
  let cachedResponse = await cache.match(proxyURL);
  if (cachedResponse) {
    return cachedResponse;
  }

  const requestEtag = context.request.headers.get("If-None-Match");
  const requestIfModifiedSince =
    context.request.headers.get("If-Modified-Since");

  const proxyRequest = new Request(proxyURL, {
    method: "GET",
    headers: new Headers({
      "If-None-Match": requestEtag,
      "If-Modified-Since": requestIfModifiedSince,
      "User-Agent": context.env.USER_AGENT,
    }),
  });

  let proxiedResponse = await getProxiedResponse(
    proxyRequest,
    responseHeaders
  );

  if (!allowedFeedURLs.has(proxyURL)) {
    // Anything that isn't a feed is an article page
    proxiedResponse = await getArticleHeadResponse(proxiedResponse);
  }

  if (proxiedResponse.ok) {
    // Write the proxied response to the cache; it will expire in 1 hour.
    // For article pages, this is only the page's <head>.
    cachedResponse = proxiedResponse.clone();
    // Keep the publisher's Cache-Control so the client can still use it as a refresh hint
    cachedResponse.headers.set(
      ORIGINAL_CACHE_CONTROL_HEADER,
      proxiedResponse.headers.get("Cache-Control") ?? ""
    );
    cachedResponse.headers.set("Cache-Control", "max-age=3600");
    await cache.put(proxyURL, cachedResponse);
  }

  return proxiedResponse;
};
