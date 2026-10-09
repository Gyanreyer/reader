/**
 * Gets the URL of the feed the article list is filtered to (the single-feed view), if any.
 * The sidebar's feed links load a new page, so this doesn't change while a page is open.
 *
 * @returns {string | null}
 */
export function getFilterFeedURL() {
  return new URLSearchParams(window.location.search).get("filter-feed-url");
}
