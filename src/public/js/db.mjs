const { Dexie } = await import("/lib/dexie.mjs");

export const db = new Dexie("FeedsDatabase");

db.version(1).stores({
  etags: "url",
  feeds: "url, title",
  articles: "url, feedURL, title, publishedAt, readAt",
});
