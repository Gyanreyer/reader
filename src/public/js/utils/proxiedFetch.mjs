/**
 * @param {string} url
 * @param {RequestInit} [options]
 */
export function proxiedFetch(url, options) {
  return fetch(`/api/proxy?url=${encodeURIComponent(url)}`, options);
}
