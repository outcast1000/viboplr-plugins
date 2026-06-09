// Write recommended.json from a declarative list of plugin IDs.
// Used by the "Set recommended plugins" workflow, and runnable locally:
//   node scripts/set-recommended.mjs youtube spotify-browse
//   node scripts/set-recommended.mjs "youtube, spotify-browse"
//   node scripts/set-recommended.mjs ""          # clears (none recommended)
//
// The given list becomes the COMPLETE recommended set. IDs must exist in
// index.json. Run scripts/sync-recommended.mjs afterwards to apply the flags
// (the workflows chain them automatically).

import { readFileSync, writeFileSync } from "node:fs";
import { RECOMMENDED_FILE } from "./recommended.mjs";

const INDEX = "index.json";

// Accept ids as multiple args and/or a single comma/space-separated string.
const raw = process.argv.slice(2).join(" ");
const ids = [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];

const index = JSON.parse(readFileSync(INDEX, "utf8"));
const known = new Set(index.plugins.map((p) => p.id));

const unknown = ids.filter((id) => !known.has(id));
if (unknown.length) {
  console.error(`✗ Unknown plugin id(s): ${unknown.join(", ")}`);
  console.error(`  Known ids: ${[...known].sort().join(", ")}`);
  process.exit(1);
}

writeFileSync(RECOMMENDED_FILE, JSON.stringify(ids, null, 2) + "\n");
console.log(`✓ ${RECOMMENDED_FILE} → [${ids.join(", ") || "(none)"}]`);
console.log(`  Next: node scripts/sync-recommended.mjs`);
