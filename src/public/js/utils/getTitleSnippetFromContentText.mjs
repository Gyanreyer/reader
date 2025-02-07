const whiteSpaceRegex = /\s/;

const TARGET_TITLE_SNIPPET_LENGTH = 50;

/**
 * @param {string} contentText
 */
export function getTitleSnippetFromContentText(contentText) {
  let titleSnippet = "";
  let currentWord = "";

  const trimmedContentText = contentText.trim();

  const fullContentLength = trimmedContentText.length;

  let shouldIncludeEllipsis = false;

  for (let i = 0; i < fullContentLength; ++i) {
    const char = trimmedContentText[i];
    if (whiteSpaceRegex.test(char)) {
      if (currentWord) {
        titleSnippet = titleSnippet
          ? `${titleSnippet} ${currentWord}`
          : currentWord;
        currentWord = "";
        if (titleSnippet.length > TARGET_TITLE_SNIPPET_LENGTH) {
          shouldIncludeEllipsis = true;
          break;
        }
      }
    } else {
      currentWord += char;
    }
  }

  return `${titleSnippet}${shouldIncludeEllipsis ? "..." : ""}`;
}
