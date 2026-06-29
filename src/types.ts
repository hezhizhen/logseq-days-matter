/**
 * "Date property types" — the shape each tracked property (birthday, death
 * anniversary, …) takes. The two built-in types are defined in the settings
 * schema (`src/index.ts`); adding another currently means adding it there too.
 */

/** How a date repeats. `none` = a fixed one-off date (count down / up to it). */
export type Recurrence =
  | "yearly"
  | "monthly"
  | "weekly"
  | "none"
  | { everyDays: number };

/** What number to display for an entry. */
export type ShowKind = "age" | "ordinal" | "daysUntil" | "daysSince" | "none";

export interface DateType {
  /** Page property name, e.g. "birthday". */
  property: string;
  /** Human label, e.g. "Birthday". */
  label: string;
  /** Display icon / emoji, distinct per type. */
  icon: string;
  recurrence: Recurrence;
  /** Days before the next occurrence to start showing this entry. */
  leadDays: number;
  show: ShowKind;
}
