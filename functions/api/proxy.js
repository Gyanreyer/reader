/**
 * @import { PagesFunction } from '@cloudflare/workers-types';
 */

/**
 * @type {PagesFunction}
 */
export const onRequest = async (context) => {
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
      }
    );
  }

  const proxyURL = requestURL.searchParams.get("url");
  if (!proxyURL) {
    return new Response(
      `No proxy URL param provided on request URL ${requestURL.toString()}`,
      {
        status: 400,
      }
    );
  }

  const proxiedResponse = await fetch(proxyURL, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  return proxiedResponse;
};
