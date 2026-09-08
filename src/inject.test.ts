import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import { setupInjection } from "./inject";
import type { RenderEntry } from "./render";

vi.mock("@logseq/libs", () => ({}));

const today = new Date(2026, 8, 7, 12);
const entries: RenderEntry[] = [{
  icon: "🎂",
  label: "Birthday",
  pageName: "Alice",
  show: "age",
  occ: { next: dayjs(today), daysUntil: 0, daysSince: null, count: 30 },
}];

function createHost(className: string, page: { journalDay?: number } | null) {
  const classes = new Set(className.split(/\s+/));
  const matches = (selector: string) => selector.split(",").some((part) => {
    const compound = part.trim();
    if (!/^(\.[\w-]+)+$/.test(compound)) {
      throw new Error(`Unsupported fixture selector: ${compound}`);
    }
    return compound.slice(1).split(".").every((name) => classes.has(name));
  });
  const host = { html: "", css: "", matches };
  vi.stubGlobal("logseq", {
    provideStyle: (css: string) => { host.css = css; },
    provideModel: vi.fn(),
    provideUI: ({ path, template }: { path: string; template: string }) => {
      if (matches(path)) host.html = template;
    },
    Editor: { getCurrentPage: async () => page },
    UI: { queryElementRect: async (selector: string) => matches(selector) ? { width: 800, height: 600 } : null },
    App: { onRouteChanged: vi.fn() },
    onSettingsChanged: vi.fn(),
  });
  return host;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(today);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("journal injection", () => {
  it.each([
    ["flex-1 journal page", null],
    ["flex-1 page relative is-journals", { journalDay: 20260907 }],
  ])("shows the configured empty window in %s", async (className, page) => {
    const host = createHost(className, page);
    setupInjection(async () => [], () => 7);
    await vi.advanceTimersByTimeAsync(5200);
    expect(host.html).toContain('<li class="dm-item">暂无提醒</li>');
  });

  it("does not show an empty state on a past journal", async () => {
    const host = createHost("flex-1 page relative is-journals", { journalDay: 20260906 });
    setupInjection(async () => [], () => 7);
    await vi.advanceTimersByTimeAsync(5200);
    expect(host.html).not.toContain("dm-root");
  });

  it("keeps the section hidden without an enabled reminder window", async () => {
    const host = createHost("flex-1 journal page", null);
    setupInjection(async () => [], () => undefined);
    await vi.advanceTimersByTimeAsync(5200);
    expect(host.html).not.toContain("dm-root");
  });

  it.each([
    ["Home", "flex-1 journal page", null],
    ["today's standalone journal", "flex-1 page relative is-journals", { journalDay: 20260907 }],
  ])("renders reminders on %s", async (_name, className, page) => {
    const host = createHost(className, page);
    setupInjection(async () => entries);
    await vi.advanceTimersByTimeAsync(5200);
    expect(host.html).toContain('data-page="Alice"');
    expect(host.html).toContain("age 30 · today");
  });

  it.each([
    ["past journal", "flex-1 page relative is-journals", { journalDay: 20260906 }],
    ["ordinary page", "flex-1 page relative", {}],
  ])("does not show reminders on a %s", async (_name, className, page) => {
    const host = createHost(className, page);
    setupInjection(async () => entries);
    await vi.advanceTimersByTimeAsync(5200);
    expect(host.html).not.toContain('data-page="Alice"');
  });

  it.each(["flex-1 journal page", "flex-1 page relative is-journals"])(
    "scopes all ordering rules to the reminder container: %s",
    (className) => {
      const host = createHost(className, null);
      setupInjection(async () => entries);
      const rules = [...host.css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]+)\}/g)]
        .filter(([, , declarations]) => /flex-direction|order:/.test(declarations));
      expect(rules).toHaveLength(3);
      for (const [, selectors] of rules) {
        const clean = selectors.replace(/\/\*[\s\S]*?\*\//g, "").trim();
        expect(clean.split(",").some((selector) =>
          selector.includes(":has(.dm-root)") && host.matches(selector.split(":has(.dm-root)")[0]),
        )).toBe(true);
      }
    },
  );
});
