import dayjs, { Dayjs } from "dayjs";
import type { ParsedDate } from "./dateParse";
import type { Recurrence } from "./types";

export interface Occurrence {
  /** The next (or only, for `none`) occurrence date. */
  next: Dayjs;
  /** Whole days from today to `next`. Negative if `next` is in the past. */
  daysUntil: number;
  /**
   * Whole days since the original date (year known) — else null.
   * For `none` this is days since the fixed date.
   */
  daysSince: number | null;
  /**
   * Count of completed periods at `next` (e.g. age turning, Nth anniversary).
   * Null when the year is unknown or not meaningful.
   */
  count: number | null;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Build a date, clamping Feb 29 in non-leap years to Feb 28. */
function makeDate(year: number, month: number, day: number): Dayjs {
  let d = day;
  if (month === 2 && day === 29 && !isLeap(year)) d = 28;
  return dayjs(new Date(year, month - 1, d)).startOf("day");
}

/**
 * Compute the next occurrence and derived numbers for a parsed date under a
 * recurrence rule, relative to `today` (defaults to now; pass a fixed value
 * in tests).
 */
export function computeOccurrence(
  parsed: ParsedDate,
  recurrence: Recurrence,
  today: Dayjs = dayjs(),
): Occurrence {
  const t = today.startOf("day");
  const { month, day, year } = parsed;

  // Original/anchor date. When year is unknown, anchor on this year.
  const anchorYear = year ?? t.year();
  const anchor = makeDate(anchorYear, month, day);

  const daysSince = (from: Dayjs): number | null =>
    year === null ? null : t.diff(from, "day");

  if (recurrence === "none") {
    const next = anchor;
    const daysUntil = next.diff(t, "day");
    return { next, daysUntil, daysSince: t.diff(next, "day"), count: null };
  }

  if (recurrence === "yearly") {
    let next = makeDate(t.year(), month, day);
    if (next.isBefore(t, "day")) next = makeDate(t.year() + 1, month, day);
    const count = year === null ? null : next.year() - year;
    return { next, daysUntil: next.diff(t, "day"), daysSince: daysSince(anchor), count };
  }

  if (recurrence === "monthly") {
    let next = t.date(Math.min(day, t.daysInMonth()));
    if (next.isBefore(t, "day")) {
      // Roll to next month, clamping `day` to *that* month's length so a big
      // day-of-month (e.g. 30/31) can't overflow into the month after.
      const m = next.add(1, "month");
      next = m.date(Math.min(day, m.daysInMonth()));
    }
    next = next.startOf("day");
    const count = year === null ? null : next.diff(anchor, "month");
    return { next, daysUntil: next.diff(t, "day"), daysSince: daysSince(anchor), count };
  }

  if (recurrence === "weekly") {
    const targetWeekday = anchor.day();
    const delta = (targetWeekday - t.day() + 7) % 7;
    const next = t.add(delta, "day").startOf("day");
    const count = year === null ? null : next.diff(anchor, "week");
    return { next, daysUntil: next.diff(t, "day"), daysSince: daysSince(anchor), count };
  }

  // { everyDays: N }
  const n = Math.max(1, Math.floor(recurrence.everyDays));
  const elapsed = t.diff(anchor, "day");
  const steps = elapsed <= 0 ? 0 : Math.ceil(elapsed / n);
  const next = anchor.add(steps * n, "day").startOf("day");
  const count = next.diff(anchor, "day") / n;
  return { next, daysUntil: next.diff(t, "day"), daysSince: daysSince(anchor), count };
}
