/**
 * @import { PagesFunction } from '@cloudflare/workers-types';
 */

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

  if (requestURL.hostname !== context.env.ALLOWED_ORIGIN) {
    return new Response(
      `Request origin ${requestURL.toString()} is not allowed`,
      {
        status: 403,
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

  try {
    const requestEtag = context.request.headers.get("If-None-Match");
    const requestIfModifiedSince =
      context.request.headers.get("If-Modified-Since");
    const proxyRequestHeaders = new Headers({
      "If-None-Match": requestEtag,
      "If-Modified-Since": requestIfModifiedSince,
    });

    const proxiedResponse = await fetch(proxyURL, {
      method: context.request.method,
      headers: proxyRequestHeaders,
      body: context.request.body,
    });

    if (proxiedResponse.ok) {
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
