// Single source of truth for which plugins are "recommended".
//
// recommended.json is a plain array of plugin IDs, e.g. ["youtube", "genius"].
// That list is the ONLY place recommendations are authored. The `recommended`
// boolean on each index.json entry is DERIVED from it — never hand-set. This
// module applies the list to an index and keeps the canonical sort order, and
// is shared by the sync CLI, the submission processor, and the PR validator.

import { readFileSync, existsSync } from "node:fs";

export const RECOMMENDED_FILE = "recommended.json";

/** Read recommended.json → array of ids (deduped). Missing file = []. */
export function readRecommendedIds(file = RECOMMENDED_FILE) {
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw)) throw new Error(`${file} must be a JSON array of plugin ids.`);
  const ids = raw.map((x) => String(x).trim()).filter(Boolean);
  return [...new Set(ids)];
}

/** Canonical order: recommended first, then alphabetical by name. */
export function sortPlugins(plugins) {
  return plugins.slice().sort((a, b) => {
    const r = (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
    return r !== 0 ? r : String(a.name).localeCompare(String(b.name));
  });
}

/** Mutates `index.plugins`: sets recommended=true on ids in the list (deletes
 *  the flag otherwise), then re-sorts. Returns { applied, unknown } where
 *  `unknown` are recommended ids with no matching plugin (caller decides if
 *  that's an error). Idempotent — the recommended set always equals the list. */
export function applyRecommended(index, recommendedIds) {
  const set = new Set(recommendedIds);
  const present = new Set(index.plugins.map((p) => p.id));
  for (const p of index.plugins) {
    if (set.has(p.id)) p.recommended = true;
    else delete p.recommended; // absent = false (keeps the index clean)
  }
  index.plugins = sortPlugins(index.plugins);
  const applied = recommendedIds.filter((id) => present.has(id));
  const unknown = recommendedIds.filter((id) => !present.has(id));
  return { applied, unknown };
}
