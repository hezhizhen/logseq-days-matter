import "@logseq/libs";
import dayjs from "dayjs";
import { buildSection, GOTO_MODEL, type RenderEntry } from "./render";

/** Key for our injected element. */
const UI_KEY = "days-matter-journal";
/**
 * Container to anchor the section under: the per-day wrapper `.flex-1.journal.page`,
 * which is the *direct* parent of both the native "scheduled and deadline" block
 * and the references block. We inject here (not the outer `.journal-item.content`)
 * so our appended node becomes a real sibling of scheduled/references — a
 * prerequisite for the CSS `order` reordering below to work at all.
 *
 * Structure verified at runtime (both journals home and a single-day page):
 *   .flex-1.journal.page
 *     ├─ .flex.flex-col      (day blocks)
 *     ├─ .mt-10
 *     ├─ .lazy-visibility    (scheduled-and-deadline)
 *     ├─ .lazy-visibility    (references)
 *     └─ <div> > .dm-root    (our section, appended last by provideUI)
 *
 * On journals home there is one `.flex-1.journal.page` per day; `querySelector`
 * returns the first, which is today's (top) block. Note: an earlier `.page.is-journals`
 * selector was a dead end — that element does not exist in this Logseq version
 * (verified: it never matched, so the old CSS `order` rules never applied).
 */
const CONTAINER_SELECTOR = ".flex-1.journal.page";

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

/* Position the section between the native "scheduled and deadline" block and
   the references — WITHOUT moving the DOM node. provideUI({path}) can only
   append to the container's end (after references), and a marketplace (lsp://)
   install is cross-origin so we can't relocate the node in JS. Instead we flex
   the container and reorder via CSS \`order\`, which is origin-safe.

   This works because we inject into \`.flex-1.journal.page\` (see CONTAINER_SELECTOR):
   the day blocks, the scheduled block, the references block AND our appended
   section are all *direct children* of it — i.e. real siblings that \`order\` can
   sort. Structure verified at runtime; the previously-tried \`.page.is-journals\`
   container does not exist in this Logseq version, which is why the old rules
   never took effect.

   Scoped with \`:has(.dm-root)\` so only a day that actually contains our section
   is touched; every other page renders unchanged. \`:has()\` verified at runtime.
   Day blocks + scheduled keep the default order:0 (DOM order preserved), our
   section gets a middle order, and the references block is pushed last. */
.flex-1.journal.page:has(.dm-root) { display: flex; flex-direction: column; }
.flex-1.journal.page:has(.dm-root) > div:has(> .dm-root) { order: 5; }
.flex-1.journal.page:has(.dm-root) > div:has(.references) { order: 10; }
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

/**
 * Wait for the container to exist in the host document, then run cb.
 *
 * Must NOT touch `parent.document`: when installed from the marketplace the
 * plugin iframe is served from `lsp://logseq.io`, a *different origin* than the
 * host window, so reading `parent.document` throws a cross-origin SecurityError
 * (locally, `file://`/dev is same-origin, which is why it "worked" there). We
 * instead probe via `logseq.UI.queryElementRect`, which runs the query in the
 * host and is cross-origin safe.
 */
function whenContainerReady(cb: () => void): void {
  const DEADLINE_MS = 5000;
  const POLL_MS = 100;
  let waited = 0;
  let loggedErr = false;

  const tick = async () => {
    let found = false;
    try {
      // Returns the rect (truthy) when the selector matches in the host, else null.
      found = !!(await logseq.UI.queryElementRect(CONTAINER_SELECTOR));
    } catch (e) {
      // Probe failed: treat as "not ready yet" and keep polling. Do NOT fire
      // cb here — that would run before the journal container exists, and
      // provideUI({path}) would silently no-op against a missing selector,
      // leaving the section unrendered. Log once to avoid per-tick spam.
      if (!loggedErr) {
        console.error("[days-matter] queryElementRect failed", e);
        loggedErr = true;
      }
    }
    if (found) {
      cb();
      return;
    }
    waited += POLL_MS;
    if (waited < DEADLINE_MS) setTimeout(tick, POLL_MS);
  };

  tick();
}

/** Render entries into the journal. */
function paint(entries: RenderEntry[]): void {
  logseq.provideUI({
    key: UI_KEY,
    path: CONTAINER_SELECTOR,
    template: buildSection(entries) || "<div></div>", // empty clears the section
    replace: true,
  });
  // No JS repositioning: provideUI appends to the container's end (after
  // references), and the section is moved into place purely via CSS `order`
  // (see the CSS block above). That works under both same-origin and the
  // cross-origin (lsp://) marketplace sandbox, with no `parent.document` access.
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
