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
 * NOTE: the exact pulled-map key shape from `datascriptQuery` is verified at
 * runtime in Logseq; `pick()` tolerates the common variants.
 */
export async function queryPagesWithProps(props: string[]): Promise<PropMatch[]> {
  if (props.length === 0) return [];
  const q = `[:find (pull ?b [:block/properties {:block/page [:block/original-name :block/name]}])
              :where
              [?b :block/pre-block? true]
              [?b :block/properties ?props]]`;

  let rows: any[] = [];
  try {
    rows = (await logseq.DB.datascriptQuery(q)) as any[];
  } catch (e) {
    console.error("[days-matter] datascript query failed", e);
    return [];
  }

  const want = new Set(props.map((p) => p.toLowerCase()));
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
