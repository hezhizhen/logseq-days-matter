import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import advancedFormat from "dayjs/plugin/advancedFormat.js";

dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

/** A calendar anchor. `year` is null when only month/day are known. */
export interface ParsedDate {
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** Full year, or null if unknown. */
  year: number | null;
}

/**
 * Convert a Logseq `preferredDateFormat` (date-fns style tokens) to dayjs
 * tokens. Best-effort: handles the tokens Logseq actually uses
 * (yyyy, yy, MMMM/MMM/MM/M, do, dd, d, EEEE/EEE/E).
 */
export function logseqFormatToDayjs(fmt: string): string {
  return fmt
    .replace(/do/g, "Do") // ordinal day-of-month (needs advancedFormat)
    .replace(/dd/g, "DD")
    .replace(/d/g, "D")
    .replace(/yyyy/g, "YYYY")
    .replace(/yy/g, "YY")
    .replace(/EEEE/g, "dddd")
    .replace(/EEE/g, "ddd")
    .replace(/E/g, "ddd");
  // M / MM / MMM / MMMM are identical in dayjs, leave as-is.
}

/** Strip a surrounding `[[ ... ]]` page reference, if present. */
function stripBrackets(value: string): string {
  const m = value.match(/^\[\[(.+)\]\]$/);
  return (m ? m[1] : value).trim();
}

const ISO_FULL = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const ISO_SLASH = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
// No-year forms: "--MM-DD" (ISO 8601) or "MM-DD".
const NO_YEAR = /^(?:--)?(\d{1,2})[-/](\d{1,2})$/;

function valid(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Parse a page-property value into {month, day, year?}.
 * Tries ISO forms first, then dayjs with the user's date format (converted)
 * plus a set of common fallback formats. Returns null if nothing matches.
 */
export function parseDateValue(
  raw: string,
  preferredDateFormat?: string,
): ParsedDate | null {
  if (raw == null) return null;
  const value = stripBrackets(String(raw));
  if (!value) return null;

  // 1) ISO full date
  let m = value.match(ISO_FULL) ?? value.match(ISO_SLASH);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (valid(month, day)) return { year, month, day };
  }

  // 2) No-year month/day ("--01-01" or "01-01")
  m = value.match(NO_YEAR);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (valid(month, day)) return { year: null, month, day };
  }

  // 3) dayjs with candidate formats (user's format first)
  const formats = [
    ...(preferredDateFormat ? [logseqFormatToDayjs(preferredDateFormat)] : []),
    "MMM Do, YYYY",
    "MMMM Do, YYYY",
    "MMM D, YYYY",
    "MMMM D, YYYY",
    "YYYY-MM-DD dddd",
    "YYYY-MM-DD",
    "YYYY/MM/DD",
    "DD-MM-YYYY",
    "MM-DD-YYYY",
  ];
  for (const f of formats) {
    const d = dayjs(value, f, true); // strict
    if (d.isValid()) {
      return { year: d.year(), month: d.month() + 1, day: d.date() };
    }
  }

  // 4) Last resort: lenient parse
  const d = dayjs(value);
  if (d.isValid()) {
    return { year: d.year(), month: d.month() + 1, day: d.date() };
  }
  return null;
}
