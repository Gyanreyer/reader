// The proxy (functions/api/proxy.js) sets this header when the URL permanently redirects to a new URL
export const PERMANENT_REDIRECT_HEADER = "X-Proxy-Permanent-Redirect";

// The proxy's responses always have Cache-Control: no-store, so it passes on the publisher's Cache-Control in this header
export const ORIGINAL_CACHE_CONTROL_HEADER = "X-Proxy-Original-Cache-Control";

/**
 * @param {string} url
 * @param {RequestInit} [options]
 */
export function proxiedFetch(url, options) {
  return fetch(`/api/proxy?url=${encodeURIComponent(url)}`, options);
}
