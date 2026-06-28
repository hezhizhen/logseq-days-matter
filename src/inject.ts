import "@logseq/libs";
import { buildSection, GOTO_MODEL, type RenderEntry } from "./render";

/** Key for our injected element. */
const UI_KEY = "days-matter-journal";
/**
 * Container to anchor the section under. Verified at runtime — Logseq's main
 * content container. Adjust here if a future Logseq version renames it.
 */
const CONTAINER_SELECTOR = "#main-content-container";

const CSS = `
.dm-root { margin: 8px 0 16px; padding: 10px 12px; border: 1px solid var(--ls-border-color, #ddd);
  border-radius: 8px; background: var(--ls-secondary-background-color, transparent); }
.dm-title { font-weight: 600; opacity: .8; margin-bottom: 6px; font-size: .9em; }
.dm-list { list-style: none; margin: 0; padding: 0; }
.dm-item { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.dm-icon { width: 1.3em; text-align: center; }
.dm-link { cursor: pointer; }
.dm-link:hover { text-decoration: underline; }
.dm-meta { opacity: .65; font-size: .85em; margin-left: auto; }
`;

/** True when the current view is the journals home or a journal page. */
async function isJournalContext(): Promise<boolean> {
  try {
    const page = (await logseq.Editor.getCurrentPage()) as any;
    return !page || page["journal?"] === true || page["journalDay"] != null;
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

function paint(entries: RenderEntry[]): void {
  const html = buildSection(entries);
  logseq.provideUI({
    key: UI_KEY,
    path: CONTAINER_SELECTOR,
    template: html || "<div></div>", // empty clears the section
    replace: true,
  });
}

/**
 * Wire up automatic injection of the Days Matter section into the journal view.
 * Registers route/settings listeners once; `getEntries` is read fresh each time
 * so settings/config changes are reflected.
 */
export function setupInjection(getEntries: () => Promise<RenderEntry[]>): void {
  logseq.provideStyle(CSS);
  logseq.provideModel({
    async [GOTO_MODEL](e: any) {
      const name = e?.dataset?.page;
      if (name) logseq.App.pushState("page", { name });
    },
  });

  const refresh = () =>
    whenContainerReady(async () => {
      if (!(await isJournalContext())) {
        paint([]);
        return;
      }
      paint(await getEntries());
    });

  logseq.App.onRouteChanged(() => refresh());
  logseq.onSettingsChanged(() => refresh());
  refresh();
}
