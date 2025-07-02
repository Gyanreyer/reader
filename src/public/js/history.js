/**
 * @param {string} url
 */
export const pushHistory = (url) => {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new CustomEvent("history:pushState"));
};

/**
 * @param {string} url
 */
export const replaceHistory = (url) => {
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new CustomEvent("history:replaceState"));
};

/**
 * @param {() => void} callback
 */
export const addHistoryChangeEventListener = (callback) => {
  window.addEventListener("history:pushState", callback);
  window.addEventListener("history:replaceState", callback);
  window.addEventListener("popstate", callback);

  return () => {
    window.removeEventListener("history:pushState", callback);
    window.removeEventListener("history:replaceState", callback);
    window.removeEventListener("popstate", callback);
  };
};
