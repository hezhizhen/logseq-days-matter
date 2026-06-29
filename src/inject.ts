import "@logseq/libs";
import dayjs from "dayjs";
import { buildSection, GOTO_MODEL, type RenderEntry } from "./render";

/** Key for our injected element. */
const UI_KEY = "days-matter-journal";
/**
 * Container to anchor the section under, matching where the native "scheduled
 * and deadline" block renders — *today's* journal block:
 *  - journals home (the scrolling multi-day list): the first `.journal-item.content`
 *  - a single day's page (e.g. `#/page/2026/06/29`): `.page.is-journals`
 * `querySelector` returns the first match, which on the home page is today's
 * (top) block. Verified at runtime; adjust if a future Logseq version renames.
 */
const CONTAINER_SELECTOR = ".journal-item.content, .page.is-journals";

const CSS = `
/* Mirror Logseq's native "scheduled and deadline" block: a 32px top gap (mt-8),
   an H2-style heading OUTSIDE the box, then a grey rounded card with the list.
   Values measured from the native block at runtime. */
.dm-root { margin: 32px 0 0; padding: 0; }
.dm-title { font-size: 16px; font-weight: 500; text-transform: uppercase;
  color: var(--ls-primary-text-color, rgb(23, 23, 23)); margin: 0; }
.dm-list { list-style: none; margin: 8px 0; padding: 16px; border-radius: 4px;
  background: var(--color-level-1, rgb(247, 248, 248)); }
.dm-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.dm-icon { width: 1.3em; text-align: center; }
.dm-link { cursor: pointer; }
.dm-link:hover { text-decoration: underline; }
.dm-meta { opacity: .65; font-size: .85em; margin-left: auto; }
`;

/**
 * True when today's journal is on screen — mirroring the native "scheduled and
 * deadline" block, which only shows on *today's* journal. That means either the
 * journals home (where today is the top block; `getCurrentPage()` returns null)
 * or a single-day page whose `journalDay` equals today.
 */
async function isTodayVisible(): Promise<boolean> {
  try {
    const page = (await logseq.Editor.getCurrentPage()) as any;
    // Journals home: not on a specific page → today's block is shown at top.
    if (!page) return true;
    // A page: only when it's a journal AND it is today.
    const todayNum = Number(dayjs().format("YYYYMMDD"));
    return page["journalDay"] === todayNum;
  } catch {
    return true; // default to showing
  }
}

/** Wait for the container to exist in the host document, then run cb. */
function whenContainerReady(cb: () => void): void {
  const doc = parent.document;
  if (doc.querySelector(CONTAINER_SELECTOR)) {
    cb();
    return;
  }
  const obs = new MutationObserver(() => {
    if (doc.querySelector(CONTAINER_SELECTOR)) {
      obs.disconnect();
      cb();
    }
  });
  obs.observe(doc.body, { childList: true, subtree: true });
  // Safety: stop observing after a few seconds.
  setTimeout(() => obs.disconnect(), 5000);
}

/**
 * Move our injected node to match the native order (… → scheduled-and-deadline
 * → Days Matter → references). `provideUI({replace:true})` always appends as the
 * container's last child — i.e. *after* references — so we relocate it once it's
 * in the DOM.
 *
 * Primary anchor: the native "scheduled and deadline" block, which has a stable
 * class (`.scheduled-or-deadlines`, hard-coded in Logseq). We insert right after
 * it. That block only renders when there's scheduled data, so as a fallback
 * (no scheduled items today) we place ourselves before the references section,
 * identified by its heading text. If neither anchor is found we leave the node
 * appended at the end rather than risk moving it somewhere wrong.
 */
function repositionInJournal(): void {
  const doc = parent.document;
  const node = doc.querySelector<HTMLElement>(
    '[data-injected-ui*="days-matter"]',
  );
  const wrap = node?.parentElement;
  if (!node || !wrap) return;

  // Primary: insert just after the native scheduled-and-deadline block. It may
  // be nested (e.g. inside a `.lazy-visibility` wrapper), so find it anywhere
  // under wrap, then walk up to wrap's direct child to insert after.
  const scheduled = wrap.querySelector(".scheduled-or-deadlines");
  if (scheduled) {
    let anchor: HTMLElement = scheduled as HTMLElement;
    while (anchor.parentElement && anchor.parentElement !== wrap) {
      anchor = anchor.parentElement;
    }
    if (anchor.parentElement === wrap && anchor.nextElementSibling !== node) {
      anchor.after(node);
    }
    return;
  }

  // Fallback: insert before the references section (heading-text match).
  const refs = [...wrap.children].find(
    (c) =>
      c !== node &&
      /^\s*(Unlinked|Linked) References/.test(c.textContent ?? ""),
  );
  if (refs && refs.previousElementSibling !== node) {
    wrap.insertBefore(node, refs);
  }
}

/** Render entries into the journal. */
function paint(entries: RenderEntry[]): void {
  logseq.provideUI({
    key: UI_KEY,
    path: CONTAINER_SELECTOR,
    template: buildSection(entries) || "<div></div>", // empty clears the section
    replace: true,
  });
  // provideUI appends asynchronously; relocate after it lands in the DOM.
  setTimeout(repositionInJournal, 0);
}

/**
 * Wire up automatic injection of the Days Matter section into the journal view.
 * Registers route/settings listeners once; `getEntries` is read fresh each time
 * so settings/config changes are reflected.
 *
 * Refreshes are debounced (route changes fire rapidly during navigation) and
 * guarded against re-entrancy: if a refresh is already running, the latest
 * request is deferred and run once when it finishes — so queries never stack.
 */
export function setupInjection(getEntries: () => Promise<RenderEntry[]>): void {
  logseq.provideStyle(CSS);
  logseq.provideModel({
    async [GOTO_MODEL](e: any) {
      const name = e?.dataset?.page;
      if (name) logseq.App.pushState("page", { name });
    },
  });

  const DEBOUNCE_MS = 150;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;

  const runOnce = () =>
    whenContainerReady(async () => {
      if (running) {
        pending = true; // coalesce into a single follow-up run
        return;
      }
      running = true;
      try {
        if (!(await isTodayVisible())) {
          paint([]);
        } else {
          paint(await getEntries());
        }
      } catch (e) {
        console.error("[days-matter] refresh failed", e);
      } finally {
        running = false;
        if (pending) {
          pending = false;
          runOnce(); // a request arrived mid-flight — serve it now
        }
      }
    });

  const refresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runOnce, DEBOUNCE_MS);
  };

  logseq.App.onRouteChanged(() => refresh());
  logseq.onSettingsChanged(() => refresh());
  refresh();
}
