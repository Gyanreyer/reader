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
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    if (secondsAgo <= 30) {
      this.textContent = "Just now";
    } else if (minutesAgo <= 45) {
      this.textContent = `${minutesAgo} minute${
        minutesAgo === 1 ? "" : "s"
      } ago`;
    } else if (hoursAgo < 8) {
      const roundedHours = Math.round(hoursAgo);
      this.textContent = `${roundedHours} hour${
        roundedHours === 1 ? "" : "s"
      } ago`;
    } else if (daysAgo < 2) {
      const isToday = currentDate.getDate() === date.getDate();
      if (isToday) {
        this.textContent = "Today";
      } else {
        this.textContent = "Yesterday";
      }
    } else if (daysAgo <= 28) {
      this.textContent = `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
    } else {
      const yearsDiff = currentDate.getFullYear() - date.getFullYear();
      const monthsAgo =
        12 * (yearsDiff - 1) + 12 + currentDate.getMonth() - date.getMonth();

      if (monthsAgo < 1) {
        this.textContent = `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
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
