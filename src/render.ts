import type { Occurrence } from "./occurrence";
import type { ShowKind } from "./types";

export interface RenderEntry {
  icon: string;
  label: string;
  pageName: string;
  show: ShowKind;
  occ: Occurrence;
}

/** data-on-click model name used by the injected page links. */
export const GOTO_MODEL = "dmGoto";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ordinalSuffix(n: number): string {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 13) return "th";
  switch (abs % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** "today" / "in 3 days" / "2 days ago". */
export function formatTiming(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil > 0) return `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
  const n = -daysUntil;
  return `${n} day${n === 1 ? "" : "s"} ago`;
}

/** The per-type number, e.g. "age 30", "5th", "1200 days". Empty if N/A. */
export function formatShow(show: ShowKind, occ: Occurrence): string {
  switch (show) {
    case "age":
      return occ.count == null ? "" : `age ${occ.count}`;
    case "ordinal":
      return occ.count == null ? "" : `${occ.count}${ordinalSuffix(occ.count)}`;
    case "daysSince":
      return occ.daysSince == null ? "" : `${occ.daysSince} days`;
    case "daysUntil":
    case "none":
    default:
      return "";
  }
}

function renderItem(e: RenderEntry): string {
  const meta = [formatShow(e.show, e.occ), formatTiming(e.occ.daysUntil)]
    .filter(Boolean)
    .join(" · ");
  return (
    `<li class="dm-item">` +
    `<span class="dm-icon">${escapeHtml(e.icon)}</span>` +
    `<a class="dm-link" data-on-click="${GOTO_MODEL}" ` +
    `data-page="${escapeHtml(e.pageName)}">${escapeHtml(e.pageName)}</a>` +
    `<span class="dm-meta">${escapeHtml(meta)}</span>` +
    `</li>`
  );
}

/**
 * Build the section HTML for the given (already filtered & sorted) entries.
 * Returns "" when there is nothing to show.
 */
export function buildSection(entries: RenderEntry[]): string {
  if (entries.length === 0) return "";
  const items = entries.map(renderItem).join("");
  return (
    `<div class="dm-root">` +
    `<div class="dm-title">📅 Days Matter</div>` +
    `<ul class="dm-list">${items}</ul>` +
    `</div>`
  );
}
