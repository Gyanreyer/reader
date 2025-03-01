import { html, LitElement } from "/lib/lit.js";

export class RelativeDate extends LitElement {
  connectedCallback() {
    super.connectedCallback();

    const parentTimeElement = this.parentElement;
    if (parentTimeElement?.tagName !== "TIME") {
      console.error("<relative-date> must be a child of a <time> element");
      return;
    }

    const dateTime = parentTimeElement.getAttribute("datetime");
    if (!dateTime) {
      console.error(
        "<relative-date> parent <time> elements must have a datetime attribute"
      );
      return;
    }

    const date = new Date(dateTime);

    const currentDate = new Date();

    const timeDiffMs = currentDate.getTime() - date.getTime();

    const secondsAgo = Math.floor(timeDiffMs / 1000);
    const minutesAgo = Math.floor(secondsAgo / 60);
    // Hours and days are coarse enough that rounding them up front may obfuscate important
    // info for comparisons, so we will wait to round them unless we are displaying them
    const hoursAgo = minutesAgo / 60;
    const daysAgo = hoursAgo / 24;

    if (secondsAgo <= 30) {
      this.textContent = "Just now";
    } else if (minutesAgo < 60) {
      this.textContent = `${minutesAgo} minute${
        minutesAgo === 1 ? "" : "s"
      } ago`;
    } else if (daysAgo < 2) {
      const roundedHours = Math.round(hoursAgo);
      if (roundedHours <= 8 || currentDate.getDate() === date.getDate()) {
        // If the article was published within the last 8 hours, or if it was published on the same
        // day as today, show the number of hours ago
        this.textContent = `${roundedHours} hour${
          roundedHours === 1 ? "" : "s"
        } ago`;
      } else {
        // If the article was published yesterday, show "Yesterday"
        this.textContent = "Yesterday";
      }
    } else if (daysAgo <= 28) {
      const roundedDaysAgo = Math.round(daysAgo);
      this.textContent = `${roundedDaysAgo} day${
        roundedDaysAgo === 1 ? "" : "s"
      } ago`;
    } else {
      const yearsDiff = currentDate.getFullYear() - date.getFullYear();
      const monthsAgo =
        12 * (yearsDiff - 1) + 12 + currentDate.getMonth() - date.getMonth();

      if (monthsAgo < 1) {
        const roundedDaysAgo = Math.round(daysAgo);
        this.textContent = `${roundedDaysAgo} day${
          roundedDaysAgo === 1 ? "" : "s"
        } ago`;
      } else if (monthsAgo < 12) {
        this.textContent = `${monthsAgo} month${
          monthsAgo === 1 ? "" : "s"
        } ago`;
      } else {
        const roundedYearsAgo = Math.round(monthsAgo / 12);
        this.textContent = `${roundedYearsAgo} year${
          roundedYearsAgo === 1 ? "" : "s"
        } ago`;
      }
    }
  }

  render() {
    return html`<slot></slot>`;
  }

  static {
    customElements.define("relative-date", RelativeDate);
  }
}
