/**
 * Config-driven "date property types". Adding a new type (wedding, work
 * anniversary, a one-off countdown, …) means adding one entry here / in
 * plugin settings — no code change.
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
  /**
   * Days before the next occurrence to start showing this entry.
   * `null` => fall back to the graph's `:scheduled/future-days`.
   */
  leadDays: number | null;
  show: ShowKind;
}

/** Shipped defaults. Users override via plugin settings (`types`). */
export const DEFAULT_TYPES: DateType[] = [
  {
    property: "birthday",
    label: "Birthday",
    icon: "🎂",
    recurrence: "yearly",
    leadDays: 7,
    show: "age",
  },
  {
    property: "deathday",
    label: "Death anniversary",
    icon: "🕯️",
    recurrence: "yearly",
    leadDays: 0,
    show: "ordinal",
  },
];

/** Used when a type's `leadDays` is null and the graph config is unreadable. */
export const DEFAULT_FUTURE_DAYS = 7;
