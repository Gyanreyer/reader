let r = await fetch("feed.xml", {
  method: "GET",
  headers: {
    // "If-None-Match": null if we want to force the server to return the content
    "If-None-Match": 'W/"2a-17f1a2b3b00"',
  },
});

if (r.status === 304) {
  // unmodified
} else {
  const newEtag = r.headers.get("etag");
}
