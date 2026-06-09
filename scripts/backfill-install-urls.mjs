// One-time backfill: add `installUrl` to every plugin entry by reading each
// plugin's live update.json "file". Idempotent — safe to re-run. Run:
//   node scripts/backfill-install-urls.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fetchJson, isHttpsUrl } from "./lib.mjs";

const INDEX = "index.json";
const index = JSON.parse(readFileSync(INDEX, "utf8"));

for (const p of index.plugins) {
  if (p.installUrl) {
    console.log(`= ${p.id}: already has installUrl`);
    continue;
  }
  try {
    const update = await fetchJson(p.updateUrl);
    if (!isHttpsUrl(update.file)) throw new Error(`update.json "file" is not https: ${update.file}`);
    // Rebuild the entry preserving key order, inserting installUrl after updateUrl.
    const rebuilt = {};
    for (const [k, v] of Object.entries(p)) {
      rebuilt[k] = v;
      if (k === "updateUrl") rebuilt.installUrl = String(update.file);
    }
    if (!rebuilt.installUrl) rebuilt.installUrl = String(update.file); // no updateUrl key (shouldn't happen)
    Object.keys(p).forEach((k) => delete p[k]);
    Object.assign(p, rebuilt);
    console.log(`✓ ${p.id}: ${p.installUrl}`);
  } catch (e) {
    console.error(`✗ ${p.id}: ${e.message}`);
    process.exitCode = 1;
  }
}

writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
console.log("\nWrote index.json");
