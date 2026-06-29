import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { computeOccurrence } from "./occurrence";

const TODAY = dayjs("2026-06-28");
const fmt = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");

describe("computeOccurrence — yearly", () => {
  it("rolls to next year when this year's date has passed (birthday)", () => {
    const o = computeOccurrence({ year: 1990, month: 1, day: 1 }, "yearly", TODAY);
    expect(fmt(o.next)).toBe("2027-01-01");
    expect(o.count).toBe(37); // age turning at next birthday
    expect(o.daysUntil).toBeGreaterThan(0);
  });

  it("uses this year when the date is still ahead", () => {
    const o = computeOccurrence({ year: 1990, month: 12, day: 25 }, "yearly", TODAY);
    expect(fmt(o.next)).toBe("2026-12-25");
    expect(o.count).toBe(36);
  });

  it("treats today as the occurrence (daysUntil 0)", () => {
    const o = computeOccurrence({ year: 2000, month: 6, day: 28 }, "yearly", TODAY);
    expect(fmt(o.next)).toBe("2026-06-28");
    expect(o.daysUntil).toBe(0);
    expect(o.count).toBe(26);
  });

  it("count is null when the year is unknown", () => {
    const o = computeOccurrence({ year: null, month: 1, day: 1 }, "yearly", TODAY);
    expect(fmt(o.next)).toBe("2027-01-01");
    expect(o.count).toBeNull();
    expect(o.daysSince).toBeNull();
  });

  it("clamps Feb 29 to Feb 28 in a non-leap target year", () => {
    const o = computeOccurrence({ year: 2000, month: 2, day: 29 }, "yearly", TODAY);
    expect(fmt(o.next)).toBe("2027-02-28"); // 2027 is not a leap year
    expect(o.count).toBe(27);
  });
});

describe("computeOccurrence — none (one-off)", () => {
  it("counts down to a future fixed date", () => {
    const o = computeOccurrence({ year: 2026, month: 12, day: 31 }, "none", TODAY);
    expect(fmt(o.next)).toBe("2026-12-31");
    expect(o.daysUntil).toBeGreaterThan(0);
    expect(o.count).toBeNull();
  });

  it("goes negative for a past fixed date", () => {
    const o = computeOccurrence({ year: 2020, month: 1, day: 1 }, "none", TODAY);
    expect(o.daysUntil).toBeLessThan(0);
    expect(o.daysSince).toBeGreaterThan(0);
  });
});

describe("computeOccurrence — monthly", () => {
  it("advances to the same day next month when this month's has passed", () => {
    const o = computeOccurrence({ year: null, month: 1, day: 10 }, "monthly", TODAY);
    expect(fmt(o.next)).toBe("2026-07-10"); // TODAY = 2026-06-28
    expect(o.daysUntil).toBe(12);
  });

  it("treats today as the occurrence (daysUntil 0)", () => {
    const o = computeOccurrence({ year: null, month: 1, day: 28 }, "monthly", TODAY);
    expect(fmt(o.next)).toBe("2026-06-28");
    expect(o.daysUntil).toBe(0);
  });

  it("clamps a big day-of-month to the current month's length", () => {
    // April has 30 days; day 31 should land on the 30th, not overflow to May.
    const o = computeOccurrence(
      { year: null, month: 1, day: 31 },
      "monthly",
      dayjs("2026-04-10"),
    );
    expect(fmt(o.next)).toBe("2026-04-30");
  });

  it("does not skip a month when rolling over from a month-end today (regression)", () => {
    // today = Jan 31, target day 30: the next 30th is Feb 28 (Feb has no 30th),
    // NOT Mar 2. Previously the rollover used the unclamped day and overflowed.
    const o = computeOccurrence(
      { year: null, month: 1, day: 30 },
      "monthly",
      dayjs("2026-01-31"),
    );
    expect(fmt(o.next)).toBe("2026-02-28");
    expect(o.daysUntil).toBe(28);
  });

  it("rolls a day-31 target over a 30-day month to that month's end", () => {
    // today = Apr 1, target day 31: April has no 31st, so it clamps to Apr 30.
    const o = computeOccurrence(
      { year: null, month: 1, day: 31 },
      "monthly",
      dayjs("2026-04-01"),
    );
    expect(fmt(o.next)).toBe("2026-04-30");
    expect(o.daysUntil).toBe(29);
  });
});

describe("computeOccurrence — everyDays", () => {
  it("advances by whole steps from the anchor", () => {
    const o = computeOccurrence(
      { year: 2026, month: 1, day: 1 },
      { everyDays: 100 },
      TODAY,
    );
    expect(o.count).toBe(2); // 2026-01-01 + 200 days
    expect(o.daysUntil).toBeGreaterThanOrEqual(0);
    expect(fmt(o.next)).toBe("2026-07-20");
  });
});
