import "@logseq/libs";

export interface PropMatch {
  pageName: string;
  property: string;
  value: string;
}

/** Read a value from a pulled map, tolerating namespaced/plain key variants. */
function pick(obj: any, ...keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

/**
 * Find every page whose first (pre-)block carries one of the given page
 * properties (file-graph: page properties live on the pre-block). Returns one
 * row per matching property.
 *
 * The property filter is pushed into datalog so only pre-blocks that actually
 * carry a wanted property come back, instead of pulling every pre-block that
 * has any property and filtering in JS. If that datalog form is rejected by the
 * host (older datascript, etc.) we fall back to the broad query — so a query
 * shape we can't verify against a live graph can never make the plugin silently
 * show nothing.
 *
 * NOTE: the exact pulled-map key shape from `datascriptQuery` is verified at
 * runtime in Logseq; `pick()` tolerates the common variants.
 */
export async function queryPagesWithProps(props: string[]): Promise<PropMatch[]> {
  if (props.length === 0) return [];

  const want = new Set(props.map((p) => p.toLowerCase()));

  // Logseq restricts property names to these chars, so embedding the safe ones
  // as datalog keyword literals (`:birthday`) is injection-safe.
  const safe = [...want].filter((p) => /^[a-z0-9][a-z0-9_-]*$/.test(p));

  const PULL =
    "(pull ?b [:block/properties {:block/page [:block/original-name :block/name]}])";
  const broad = `[:find ${PULL}
              :where
              [?b :block/pre-block? true]
              [?b :block/properties ?props]]`;

  let filtered: string | null = null;
  if (safe.length > 0) {
    const gets = safe.map((p) => `[(get ?props :${p})]`);
    const cond = gets.length === 1 ? gets[0] : `(or-join [?props] ${gets.join(" ")})`;
    filtered = `[:find ${PULL}
              :where
              [?b :block/pre-block? true]
              [?b :block/properties ?props]
              ${cond}]`;
  }

  let rows: any[] = [];
  try {
    rows = (await logseq.DB.datascriptQuery(filtered ?? broad)) as any[];
  } catch (e) {
    if (!filtered) {
      console.error("[days-matter] datascript query failed", e);
      return [];
    }
    // The pushed-down filter was rejected; retry with the broad query.
    try {
      rows = (await logseq.DB.datascriptQuery(broad)) as any[];
    } catch (e2) {
      console.error("[days-matter] datascript query failed", e2);
      return [];
    }
  }

  const out: PropMatch[] = [];
  for (const row of rows) {
    const b = Array.isArray(row) ? row[0] : row;
    const properties = pick(b, "properties", "block/properties", ":block/properties");
    const page = pick(b, "page", "block/page", ":block/page");
    const pageName = pick(
      page,
      "original-name",
      "originalName",
      "block/original-name",
      ":block/original-name",
      "name",
      "block/name",
    );
    if (!properties || !pageName) continue;

    for (const [k, v] of Object.entries(properties)) {
      if (!want.has(k.toLowerCase())) continue;
      const value = Array.isArray(v) ? String(v[0]) : String(v);
      if (value) out.push({ pageName: String(pageName), property: k.toLowerCase(), value });
    }
  }
  return out;
}
