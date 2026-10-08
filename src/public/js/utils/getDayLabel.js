import { getDayStart } from "../articleBatches.js";

const ONE_DAY = 24 * 60 * 60 * 1000;

const relativeDayFormat = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const monthDayFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const fullDateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Labels a discovered day: "Today", "Yesterday", the weekday name for the rest of the past week,
 * then "Sep 28", or "Sep 28, 2025" for earlier years.
 *
 * @param {number} dayStart Local midnight at the start of the day
 * @param {number} [now]
 * @returns {string}
 */
export function getDayLabel(dayStart, now = Date.now()) {
  // Round because days around a daylight saving time change aren't exactly 24 hours long
  const daysAgo = Math.round((getDayStart(now) - dayStart) / ONE_DAY);

  if (daysAgo === 0 || daysAgo === 1) {
    const label = relativeDayFormat.format(-daysAgo, "day");
    return label.charAt(0).toLocaleUpperCase() + label.slice(1);
  }

  if (daysAgo > 1 && daysAgo < 7) {
    return weekdayFormat.format(dayStart);
  }

  return new Date(dayStart).getFullYear() === new Date(now).getFullYear()
    ? monthDayFormat.format(dayStart)
    : fullDateFormat.format(dayStart);
}
