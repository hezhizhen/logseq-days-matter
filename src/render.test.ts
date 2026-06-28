import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { buildSection, formatShow, formatTiming, type RenderEntry } from "./render";
import type { Occurrence } from "./occurrence";

const occ = (over: Partial<Occurrence>): Occurrence => ({
  next: dayjs("2027-01-01"),
  daysUntil: 7,
  daysSince: null,
  count: 30,
  ...over,
});

describe("formatTiming", () => {
  it("renders today / future / past", () => {
    expect(formatTiming(0)).toBe("today");
    expect(formatTiming(1)).toBe("in 1 day");
    expect(formatTiming(7)).toBe("in 7 days");
    expect(formatTiming(-2)).toBe("2 days ago");
  });
});

describe("formatShow", () => {
  it("age", () => expect(formatShow("age", occ({ count: 30 }))).toBe("age 30"));
  it("ordinal suffixes", () => {
    expect(formatShow("ordinal", occ({ count: 1 }))).toBe("1st");
    expect(formatShow("ordinal", occ({ count: 2 }))).toBe("2nd");
    expect(formatShow("ordinal", occ({ count: 3 }))).toBe("3rd");
    expect(formatShow("ordinal", occ({ count: 11 }))).toBe("11th");
    expect(formatShow("ordinal", occ({ count: 21 }))).toBe("21st");
    expect(formatShow("ordinal", occ({ count: 23 }))).toBe("23rd");
  });
  it("daysSince and empties", () => {
    expect(formatShow("daysSince", occ({ daysSince: 1200 }))).toBe("1200 days");
    expect(formatShow("none", occ({}))).toBe("");
    expect(formatShow("age", occ({ count: null }))).toBe("");
  });
});

describe("buildSection", () => {
  it("returns empty string for no entries", () => {
    expect(buildSection([])).toBe("");
  });

  it("renders an item with link, icon and meta", () => {
    const e: RenderEntry = {
      icon: "🎂",
      label: "Birthday",
      pageName: "Alice",
      show: "age",
      occ: occ({ count: 30, daysUntil: 7 }),
    };
    const html = buildSection([e]);
    expect(html).toContain("Alice");
    expect(html).toContain("🎂");
    expect(html).toContain('data-on-click="dmGoto"');
    expect(html).toContain('data-page="Alice"');
    expect(html).toContain("age 30 · in 7 days");
  });

  it("escapes HTML in page names", () => {
    const e: RenderEntry = {
      icon: "🎂",
      label: "x",
      pageName: "<script>",
      show: "none",
      occ: occ({}),
    };
    const html = buildSection([e]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
