// Sync the `recommended` flags in index.json from recommended.json (the single
// source of truth). Run after editing recommended.json:
//   node scripts/sync-recommended.mjs            # apply + write
//   node scripts/sync-recommended.mjs --check     # verify in sync, write nothing (CI)
//
// Declarative: the recommended set in index.json always becomes exactly the
// list in recommended.json. Idempotent.

import { readFileSync, writeFileSync } from "node:fs";
import { readRecommendedIds, applyRecommended, RECOMMENDED_FILE } from "./recommended.mjs";

const INDEX = "index.json";
const check = process.argv.includes("--check");

const index = JSON.parse(readFileSync(INDEX, "utf8"));
if (!Array.isArray(index.plugins)) {
  console.error("index.json is malformed: plugins[] missing");
  process.exit(1);
}

const before = JSON.stringify(index, null, 2) + "\n";
const ids = readRecommendedIds();
const { applied, unknown } = applyRecommended(index, ids);
const after = JSON.stringify(index, null, 2) + "\n";

if (unknown.length) {
  console.error(
    `✗ ${RECOMMENDED_FILE} lists ids with no matching plugin in index.json: ${unknown.join(", ")}`,
  );
  process.exit(1);
}

if (check) {
  if (before !== after) {
    console.error(
      `✗ index.json is out of sync with ${RECOMMENDED_FILE}.\n` +
        `  Run: node scripts/sync-recommended.mjs`,
    );
    process.exit(1);
  }
  console.log(`✓ in sync — ${applied.length} recommended: ${applied.join(", ") || "(none)"}`);
} else {
  if (before !== after) {
    writeFileSync(INDEX, after);
    console.log(`✓ index.json updated — ${applied.length} recommended: ${applied.join(", ") || "(none)"}`);
  } else {
    console.log(`= already in sync — ${applied.length} recommended: ${applied.join(", ") || "(none)"}`);
  }
}
