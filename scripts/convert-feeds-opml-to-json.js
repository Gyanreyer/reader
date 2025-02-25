import { writeFile } from "node:fs/promises";
import { HTMLParser } from "tempeh-html-parser";

const opmlFeedsFilePath = process.argv[2];

const parser = new HTMLParser();

/**
 * @type {Array<{
 *  name: string;
 *  url: string;
 * }>}
 */
const feedsJSON = [];

for await (const rootLevelTag of parser.parseFile(opmlFeedsFilePath)) {
  if (
    !("tagName" in rootLevelTag) ||
    rootLevelTag.tagName !== "opml" ||
    !rootLevelTag.childStream
  ) {
    continue;
  }

  const rootOpmlTag = rootLevelTag;

  for await (const secondLevelTag of rootOpmlTag.childStream) {
    if (
      !("tagName" in secondLevelTag) ||
      secondLevelTag.tagName !== "body" ||
      !secondLevelTag.childStream
    ) {
      continue;
    }

    const bodyTag = secondLevelTag;

    for await (const bodyContentTag of bodyTag.childStream) {
      if (
        !("tagName" in bodyContentTag) ||
        bodyContentTag.tagName !== "outline"
      ) {
        continue;
      }

      /**
       * @type {string | null}
       */
      let feedName = null;
      /**
       * @type {string | null}
       */
      let feedURL = null;

      for (const attr of bodyContentTag.attributes) {
        if (attr.name === "text") {
          feedName = attr.value.trim();
        } else if (attr.name === "xmlUrl") {
          feedURL = attr.value.trim();
          if (!URL.canParse(feedURL)) {
            console.error("Encountered invalid feed URL:", feedURL);
            feedURL = null;
          }
        }
      }

      if (!feedName || !feedURL) {
        continue;
      }

      feedsJSON.push({ name: feedName, url: feedURL });
    }
  }
}

await writeFile(
  opmlFeedsFilePath.replace(/\.opml$/, ".json"),
  JSON.stringify(feedsJSON, null, 2)
);
