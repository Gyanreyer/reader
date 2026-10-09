import { html, LitElement } from "/lib/lit.js";

/**
 * @param {Date} date
 * @returns {string}
 */
function getRelativeDateLabel(date) {
  const currentDate = new Date();

  const timeDiffMs = currentDate.getTime() - date.getTime();

  const secondsAgo = Math.floor(timeDiffMs / 1000);
  const minutesAgo = Math.floor(secondsAgo / 60);
  // Hours and days are coarse enough that rounding them up front may obfuscate important
  // info for comparisons, so we will wait to round them unless we are displaying them
  const hoursAgo = minutesAgo / 60;
  const daysAgo = hoursAgo / 24;

  if (secondsAgo <= 30) {
    return "Just now";
  } else if (minutesAgo < 60) {
    return `${minutesAgo} minute${
      minutesAgo === 1 ? "" : "s"
    } ago`;
  } else if (daysAgo < 2) {
    const roundedHours = Math.round(hoursAgo);
    if (roundedHours <= 8 || currentDate.getDate() === date.getDate()) {
      // If the article was published within the last 8 hours, or if it was published on the same
      // day as today, show the number of hours ago
      return `${roundedHours} hour${
        roundedHours === 1 ? "" : "s"
      } ago`;
    } else {
      // If the article was published yesterday, show "Yesterday"
      return "Yesterday";
    }
  } else if (daysAgo <= 28) {
    const roundedDaysAgo = Math.round(daysAgo);
    return `${roundedDaysAgo} day${
      roundedDaysAgo === 1 ? "" : "s"
    } ago`;
  } else {
    const yearsDiff = currentDate.getFullYear() - date.getFullYear();
    const monthsAgo =
      12 * (yearsDiff - 1) + 12 + currentDate.getMonth() - date.getMonth();

    if (monthsAgo < 1) {
      const roundedDaysAgo = Math.round(daysAgo);
      return `${roundedDaysAgo} day${
        roundedDaysAgo === 1 ? "" : "s"
      } ago`;
    } else if (monthsAgo < 12) {
      return `${monthsAgo} month${
        monthsAgo === 1 ? "" : "s"
      } ago`;
    } else {
      const roundedYearsAgo = Math.round(monthsAgo / 12);
      return `${roundedYearsAgo} year${
        roundedYearsAgo === 1 ? "" : "s"
      } ago`;
    }
  }
}

/**
 * Shows how long ago its datetime attribute was, like "3 hours ago".
 * Its children are only shown until it has a datetime to show instead.
 */
export default class RelativeDate extends LitElement {
  static tagName = "relative-date";

  static properties = {
    datetime: {},
  };

  constructor() {
    super();

    /**
     * @type {string | undefined}
     */
    this.datetime = undefined;
  }

  render() {
    // The label is rendered in our shadow root rather than replacing our children,
    // because the children may belong to someone else's template, like Lit's
    if (!this.datetime) {
      return html`<slot></slot>`;
    }
    return getRelativeDateLabel(new Date(this.datetime));
  }

  static {
    customElements.define(this.tagName, this);
  }
}
