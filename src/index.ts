import "@logseq/libs";
import type { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";
import {
  DEFAULT_FUTURE_DAYS,
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
  { key: "birthdayLeadDays", type: "number", title: "Lead days", description: "Days before to start showing.", default: 7 },
  { key: "birthdayShow", type: "enum", enumChoices: SHOW_CHOICES, enumPicker: "select", title: "Show", description: "Number to display.", default: "age" },

  // --- Death anniversary ---
  { key: "deathdayHeading", type: "heading", title: "🕯️ Death anniversary", description: "", default: null },
  { key: "deathdayEnabled", type: "boolean", title: "Enabled", description: "Track the `deathday::` property.", default: true },
  { key: "deathdayIcon", type: "string", title: "Icon", description: "Emoji shown in the list.", default: "🕯️" },
  { key: "deathdayRecurrence", type: "enum", enumChoices: RECURRENCE_CHOICES, enumPicker: "select", title: "Recurrence", description: "", default: "yearly" },
  { key: "deathdayLeadDays", type: "number", title: "Lead days", description: "Days before to start showing (0 = day-of only).", default: 0 },
  { key: "deathdayShow", type: "enum", enumChoices: SHOW_CHOICES, enumPicker: "select", title: "Show", description: "Number to display.", default: "ordinal" },
];

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  // Logseq may return a `type:"number"` setting as a string — coerce it.
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Build the active type list from the rendered settings + extra JSON. */
function getTypes(): DateType[] {
  const s = (logseq.settings ?? {}) as Record<string, unknown>;
  const types: DateType[] = [];

  if (s.birthdayEnabled !== false) {
    types.push({
      property: "birthday",
      label: "Birthday",
      icon: str(s.birthdayIcon, "🎂"),
      recurrence: str(s.birthdayRecurrence, "yearly") as Recurrence,
      leadDays: num(s.birthdayLeadDays, 7),
      show: str(s.birthdayShow, "age") as ShowKind,
    });
  }
  if (s.deathdayEnabled !== false) {
    types.push({
      property: "deathday",
      label: "Death anniversary",
      icon: str(s.deathdayIcon, "🕯️"),
      recurrence: str(s.deathdayRecurrence, "yearly") as Recurrence,
      leadDays: num(s.deathdayLeadDays, 0),
      show: str(s.deathdayShow, "ordinal") as ShowKind,
    });
  }

  return types;
}

/** Read `:scheduled/future-days` (graph config), with fallbacks. */
async function getFutureDays(): Promise<number> {
  try {
    const cfg = (await logseq.App.getUserConfigs()) as any;
    const v = cfg?.scheduledFutureDays;
    if (typeof v === "number" && v >= 0) return v;
  } catch {
    /* ignore */
  }
  try {
    const raw = await (logseq.App as any).getCurrentGraphConfigs?.(":scheduled/future-days");
    if (typeof raw === "number" && raw >= 0) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_FUTURE_DAYS;
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
  const [futureDays, fmt] = await Promise.all([
    getFutureDays(),
    getPreferredDateFormat(),
  ]);
  const types = getTypes();
  const entries = await collectEntries(types, futureDays, fmt);
  console.debug("[days-matter] types=", types, "futureDays=", futureDays, "entries=", entries.length);
  return entries;
}

function main() {
  logseq.useSettingsSchema(SETTINGS);

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
