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
