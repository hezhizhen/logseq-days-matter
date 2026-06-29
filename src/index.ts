import "@logseq/libs";
import type { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";
import {
  type DateType,
  type Recurrence,
  type ShowKind,
} from "./types";
import { collectEntries } from "./collect";
import { setupInjection } from "./inject";
import { buildSection } from "./render";

const RECURRENCE_CHOICES = ["yearly", "monthly", "weekly", "none"];
const SHOW_CHOICES = ["age", "ordinal", "daysUntil", "daysSince", "none"];

/** Settings schema rendered as native controls (like other plugins). */
const SETTINGS: SettingSchemaDesc[] = [
  // --- Birthday ---
  { key: "birthdayHeading", type: "heading", title: "🎂 Birthday", description: "", default: null },
  { key: "birthdayEnabled", type: "boolean", title: "Enabled", description: "Track the `birthday::` property.", default: true },
  { key: "birthdayIcon", type: "string", title: "Icon", description: "Emoji shown in the list.", default: "🎂" },
  { key: "birthdayRecurrence", type: "enum", enumChoices: RECURRENCE_CHOICES, enumPicker: "select", title: "Recurrence", description: "", default: "yearly" },
  { key: "birthdayLeadDays", type: "number", title: "Lead days", description: "Days before to start showing (negatives are treated as 0).", default: 7 },
  { key: "birthdayShow", type: "enum", enumChoices: SHOW_CHOICES, enumPicker: "select", title: "Show", description: "Number to display.", default: "age" },

  // --- Death anniversary ---
  { key: "deathdayHeading", type: "heading", title: "🕯️ Death anniversary", description: "", default: null },
  { key: "deathdayEnabled", type: "boolean", title: "Enabled", description: "Track the `deathday::` property.", default: true },
  { key: "deathdayIcon", type: "string", title: "Icon", description: "Emoji shown in the list.", default: "🕯️" },
  { key: "deathdayRecurrence", type: "enum", enumChoices: RECURRENCE_CHOICES, enumPicker: "select", title: "Recurrence", description: "", default: "yearly" },
  { key: "deathdayLeadDays", type: "number", title: "Lead days", description: "Days before to start showing (negatives are treated as 0).", default: 3 },
  { key: "deathdayShow", type: "enum", enumChoices: SHOW_CHOICES, enumPicker: "select", title: "Show", description: "Number to display.", default: "ordinal" },
];

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}
function num(v: unknown, fallback: number, min = -Infinity): number {
  // Logseq may return a `type:"number"` setting as a string — coerce it.
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

/** Build the active type list from the rendered settings. */
function getTypes(): DateType[] {
  const s = (logseq.settings ?? {}) as Record<string, unknown>;
  const types: DateType[] = [];

  if (s.birthdayEnabled !== false) {
    types.push({
      property: "birthday",
      label: "Birthday",
      icon: str(s.birthdayIcon, "🎂"),
      recurrence: str(s.birthdayRecurrence, "yearly") as Recurrence,
      leadDays: num(s.birthdayLeadDays, 7, 0),
      show: str(s.birthdayShow, "age") as ShowKind,
    });
  }
  if (s.deathdayEnabled !== false) {
    types.push({
      property: "deathday",
      label: "Death anniversary",
      icon: str(s.deathdayIcon, "🕯️"),
      recurrence: str(s.deathdayRecurrence, "yearly") as Recurrence,
      leadDays: num(s.deathdayLeadDays, 3, 0),
      show: str(s.deathdayShow, "ordinal") as ShowKind,
    });
  }

  return types;
}

async function getPreferredDateFormat(): Promise<string | undefined> {
  try {
    const cfg = (await logseq.App.getUserConfigs()) as any;
    return cfg?.preferredDateFormat;
  } catch {
    return undefined;
  }
}

async function getEntries() {
  const fmt = await getPreferredDateFormat();
  const types = getTypes();
  const entries = await collectEntries(types, fmt);
  console.debug("[days-matter] types=", types, "entries=", entries.length);
  return entries;
}

/** Lead-day setting keys, clamped to >= 0 (the native number input has no min). */
const LEAD_DAY_KEYS = ["birthdayLeadDays", "deathdayLeadDays"] as const;

/**
 * Logseq's `type:"number"` control can't enforce a minimum, so a user can type
 * a negative lead-days value. Detect that and write it back to 0, which makes
 * the input visibly snap to 0. Writing back re-fires onSettingsChanged, but the
 * value is then non-negative so it converges (no loop).
 */
function clampLeadDaysSetting(): void {
  const s = (logseq.settings ?? {}) as Record<string, unknown>;
  const fixes: Record<string, number> = {};
  for (const key of LEAD_DAY_KEYS) {
    const v = s[key];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n < 0) fixes[key] = 0;
  }
  if (Object.keys(fixes).length > 0) logseq.updateSettings(fixes);
}

function main() {
  logseq.useSettingsSchema(SETTINGS);
  logseq.onSettingsChanged(clampLeadDaysSetting);

  // Fallback / on-demand: {{renderer :days-matter}} in any block.
  logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
    const type = payload?.arguments?.[0]?.trim();
    if (type !== ":days-matter") return;
    const entries = await getEntries();
    logseq.provideUI({
      key: `days-matter-${slot}`,
      slot,
      reset: true,
      template: buildSection(entries) || "<i>No upcoming dates</i>",
    });
  });

  // Primary surface: auto-inject a section at the bottom of the journal view.
  setupInjection(getEntries);
  (logseq.App as any).onCurrentGraphChanged?.(() => setupInjection(getEntries));

  console.log("[days-matter] ready");
}

logseq.ready(main).catch(console.error);
