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

/**
 * @param {Request} proxyRequest
 * @param {Headers} responseHeaders
 * @returns {Promise<Response>}
 */
const getProxiedResponse = async (proxyRequest, responseHeaders) => {
  try {
    const proxiedResponse = await fetch(proxyRequest);

    if (proxiedResponse.ok) {
      const requestEtag = proxyRequest.headers.get("If-None-Match");

      // Some servers include an Etag/Last-Modified header but still return a full 200 response
      // even if the header indicates the resource is unchanged. In this case, we'll double-check
      // the headers to see if we can return a 304 response to the client and save some bandwidth.
      if (requestEtag && proxiedResponse.headers.get("Etag") === requestEtag) {
        proxiedResponse.body.cancel();
        return new Response(null, {
          status: 304,
          responseHeaders,
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
            responseHeaders,
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
    return new Response(`Failed to proxy request to ${proxyURL}`, {
      status: 500,
      responseHeaders,
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

  const proxiedResponse = await getProxiedResponse(
    proxyRequest,
    responseHeaders
  );

  if (proxiedResponse.ok) {
    // Write the proxied response to the cache; it will expire in 1 hour
    cachedResponse = proxiedResponse.clone();
    cachedResponse.headers.set("Cache-Control", "max-age=3600");
    await cache.put(proxyURL, cachedResponse);
  }

  return proxiedResponse;
};
