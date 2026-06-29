import dayjs, { Dayjs } from "dayjs";
import { queryPagesWithProps } from "./query";
import { parseDateValue } from "./dateParse";
import { computeOccurrence } from "./occurrence";
import type { DateType } from "./types";
import type { RenderEntry } from "./render";

/**
 * Gather the entries to display: query each configured property, parse the
 * date, compute the next occurrence, keep those within the (per-type) lead
 * window, and sort by soonest.
 */
export async function collectEntries(
  types: DateType[],
  preferredDateFormat?: string,
  today: Dayjs = dayjs(),
): Promise<RenderEntry[]> {
  const byProp = new Map<string, DateType>();
  for (const t of types) byProp.set(t.property.toLowerCase(), t);

  const matches = await queryPagesWithProps([...byProp.keys()]);
  const entries: RenderEntry[] = [];

  for (const m of matches) {
    const type = byProp.get(m.property);
    if (!type) continue;
    const parsed = parseDateValue(m.value, preferredDateFormat);
    if (!parsed) continue;

    const occ = computeOccurrence(parsed, type.recurrence, today);

    // Upcoming within the lead window (today counts as 0).
    if (occ.daysUntil < 0 || occ.daysUntil > type.leadDays) continue;

    entries.push({
      icon: type.icon,
      label: type.label,
      pageName: m.pageName,
      show: type.show,
      occ,
    });
  }

  entries.sort((a, b) => a.occ.daysUntil - b.occ.daysUntil);
  return entries;
}
