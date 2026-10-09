/**
 * On desktop, <main> is the scroll container and its header sticks to the top (see index.webc).
 * This marks <main> as scrolled so the header can compact, and tracks the header's height so
 * the article list's day headers can stick just below it.
 */
const main = document.querySelector("main");
const header = main?.querySelector(":scope > header");

if (main && header instanceof HTMLElement) {
  // Compacting the header moves the content below it up, and anything that pulls the scroll position back to the
  // top expands the header again, so it would bounce on every scroll.
  const updateIsScrolled = () => {
    const isScrolled = main.hasAttribute("data-scrolled");
    // If there's less to scroll than the header shrinks by, compacting it would leave nothing to scroll
    const canCompact =
      isScrolled || main.scrollHeight - main.clientHeight > header.offsetHeight;
    const shouldBeScrolled = main.scrollTop > 0 && canCompact;
    if (shouldBeScrolled === isScrolled) {
      return;
    }

    // Scroll anchoring would scroll back by however much the header shrinks to hold the content in place,
    // so turn it off until the header has finished resizing
    main.style.overflowAnchor = "none";
    main.toggleAttribute("data-scrolled", shouldBeScrolled);
  };
  main.addEventListener("scroll", updateIsScrolled, { passive: true });
  updateIsScrolled();

  const restoreScrollAnchoring = () => {
    main.style.removeProperty("overflow-anchor");
  };
  header.addEventListener("transitionend", restoreScrollAnchoring);
  header.addEventListener("transitioncancel", restoreScrollAnchoring);

  new ResizeObserver(() => {
    main.style.setProperty("--main-header-height", `${header.offsetHeight}px`);
  }).observe(header);
}
