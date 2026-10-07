/**
 * Parses a Retry-After header, which may be either a number of seconds or an HTTP date.
 *
 * @param {string | null} retryAfterHeader
 * @returns {number | null} The timestamp to wait until, or null if the header is missing or invalid
 */
export function parseRetryAfter(retryAfterHeader) {
  const value = retryAfterHeader?.trim();
  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    return Date.now() + Number(value) * 1000;
  }

  const retryAfterDate = new Date(value).getTime();
  return Number.isNaN(retryAfterDate) ? null : retryAfterDate;
}
