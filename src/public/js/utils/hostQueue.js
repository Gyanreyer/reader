/**
 * Normalizes a URL's hostname so that "www.example.com" and "example.com" are treated as the same host.
 *
 * @param {string} url
 */
export function getHostKey(url) {
  return new URL(url).hostname.replace(/^www\./, "");
}

/**
 * The last task queued for each host.
 *
 * @type {Map<string, Promise<void>>}
 */
const hostQueueTails = new Map();

/**
 * Runs a task once every task previously queued for the same host has settled,
 * so we never make more than one request to a host at a time.
 *
 * @template T
 * @param {string} url
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
export function enqueueForHost(url, task) {
  const hostKey = getHostKey(url);

  const taskPromise = (hostQueueTails.get(hostKey) ?? Promise.resolve()).then(
    task
  );

  // The tail never rejects, so one failed task doesn't fail every task queued after it
  const tail = taskPromise.then(
    () => {},
    () => {}
  );
  hostQueueTails.set(hostKey, tail);
  tail.then(() => {
    if (hostQueueTails.get(hostKey) === tail) {
      hostQueueTails.delete(hostKey);
    }
  });

  return taskPromise;
}
