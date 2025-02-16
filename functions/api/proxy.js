/**
 * @import { PagesFunction } from '@cloudflare/workers-types';
 */

/**
 * @type {PagesFunction}
 */
export const onRequest = async (context) => {
  const responseHeaders = new Headers({
    "Access-Control-Allow-Origin": "https://reader.geyer.dev",
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
    const proxiedResponse = await fetch(proxyURL, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    });

    if (proxiedResponse.ok) {
      const requestEtag = context.request.headers.get("If-None-Match");
      if (requestEtag && proxiedResponse.headers.get("Etag") === requestEtag) {
        // Cancel the proxied response body stream to hopefully save some wasted bandwidth
        proxiedResponse.body.cancel();
        return new Response(null, {
          status: 304,
          responseHeaders,
        });
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
