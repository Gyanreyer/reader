/**
 * On desktop, <main> is the scroll container and its header sticks to the top (see index.webc).
 * This marks <main> as scrolled so the header can compact, and tracks the header's height so
 * the article list's day headers can stick just below it.
 */
const main = document.querySelector("main");
const header = main?.querySelector(":scope > header");

if (main && header instanceof HTMLElement) {
  const updateIsScrolled = () => {
    main.toggleAttribute("data-scrolled", main.scrollTop > 0);
  };
  main.addEventListener("scroll", updateIsScrolled, { passive: true });
  updateIsScrolled();

  new ResizeObserver(() => {
    main.style.setProperty("--main-header-height", `${header.offsetHeight}px`);
  }).observe(header);
}
