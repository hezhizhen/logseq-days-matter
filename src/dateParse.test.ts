import { describe, it, expect } from "vitest";
import { parseDateValue, logseqFormatToDayjs } from "./dateParse";

describe("parseDateValue", () => {
  it("parses ISO full dates", () => {
    expect(parseDateValue("1990-01-01")).toEqual({ year: 1990, month: 1, day: 1 });
    expect(parseDateValue("1990/01/01")).toEqual({ year: 1990, month: 1, day: 1 });
  });

  it("parses a leap day", () => {
    expect(parseDateValue("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
  });

  it("parses no-year month/day forms", () => {
    expect(parseDateValue("--01-01")).toEqual({ year: null, month: 1, day: 1 });
    expect(parseDateValue("01-01")).toEqual({ year: null, month: 1, day: 1 });
  });

  it("strips [[ ]] page-reference brackets", () => {
    expect(parseDateValue("[[1990-01-01]]")).toEqual({ year: 1990, month: 1, day: 1 });
  });

  it("parses a date-page name using preferredDateFormat (yyyy-MM-dd EEEE)", () => {
    expect(
      parseDateValue("[[1990-01-01 Monday]]", "yyyy-MM-dd EEEE"),
    ).toEqual({ year: 1990, month: 1, day: 1 });
  });

  it("parses the default Logseq format (MMM do, yyyy)", () => {
    expect(parseDateValue("January 1st, 1990", "MMM do, yyyy")).toEqual({
      year: 1990,
      month: 1,
      day: 1,
    });
  });

  it("returns null for non-dates", () => {
    expect(parseDateValue("not a date")).toBeNull();
    expect(parseDateValue("")).toBeNull();
  });
});

describe("logseqFormatToDayjs", () => {
  it("converts date-fns tokens to dayjs tokens", () => {
    expect(logseqFormatToDayjs("yyyy-MM-dd EEEE")).toBe("YYYY-MM-DD dddd");
    expect(logseqFormatToDayjs("MMM do, yyyy")).toBe("MMM Do, YYYY");
  });
});
