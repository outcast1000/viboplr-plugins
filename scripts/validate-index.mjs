// CI gate: validate the structural integrity of index.json on every PR.
// This catches manual edits (not just bot-opened PRs). It does NOT re-download
// every plugin zip — that would be slow and rate-limit-prone. It checks shape,
// uniqueness, and field hygiene. Exits non-zero on any error.

import { readFileSync } from "node:fs";
import { isHttpsUrl, isVersionString, isCleanText } from "./lib.mjs";
import { readRecommendedIds, RECOMMENDED_FILE } from "./recommended.mjs";

const INDEX = "index.json";
const errors = [];

let index;
try {
  index = JSON.parse(readFileSync(INDEX, "utf8"));
} catch (e) {
  console.error(`index.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

if (index.version !== 2) errors.push(`index.json "version" should be 2 (got: ${index.version}).`);
if (!Array.isArray(index.plugins)) {
  errors.push('index.json "plugins" must be an array.');
} else {
  const ids = new Set();
  index.plugins.forEach((p, i) => {
    const at = `plugins[${i}] (${p.id || "?"})`;
    if (!p.id || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) errors.push(`${at}: invalid or missing id.`);
    else if (ids.has(p.id)) errors.push(`${at}: duplicate id "${p.id}".`);
    else ids.add(p.id);
    if (!p.name || !isCleanText(p.name)) errors.push(`${at}: name missing or contains markup.`);
    if (!p.author || !isCleanText(p.author)) errors.push(`${at}: author missing or contains markup.`);
    if (!p.description || !isCleanText(p.description)) errors.push(`${at}: description missing or contains markup.`);
    if (!isHttpsUrl(p.updateUrl)) errors.push(`${at}: updateUrl must be an https URL.`);
    if (p.installUrl != null && !isHttpsUrl(p.installUrl)) errors.push(`${at}: installUrl must be an https URL if present.`);
    if (p.minAppVersion != null && !isVersionString(p.minAppVersion)) errors.push(`${at}: minAppVersion not numeric.`);
    if (p.recommended != null && typeof p.recommended !== "boolean") errors.push(`${at}: recommended must be boolean.`);
    if ("version" in p) errors.push(`${at}: drop the display-only "version" field (resolved from update.json at install).`);
  });

  // recommended.json is the single source of truth; index flags must match it.
  let recIds = [];
  try {
    recIds = readRecommendedIds();
  } catch (e) {
    errors.push(`${RECOMMENDED_FILE}: ${e.message}`);
  }
  const recSet = new Set(recIds);
  const indexIds = new Set(index.plugins.map((p) => p.id));
  for (const id of recIds) {
    if (!indexIds.has(id)) errors.push(`${RECOMMENDED_FILE} lists "${id}" but no such plugin exists in index.json.`);
  }
  index.plugins.forEach((p) => {
    const shouldBeRec = recSet.has(p.id);
    const isRec = p.recommended === true;
    if (shouldBeRec && !isRec) {
      errors.push(`plugins[${p.id}]: should be recommended (in ${RECOMMENDED_FILE}) but flag is missing. Run: node scripts/sync-recommended.mjs`);
    } else if (!shouldBeRec && isRec) {
      errors.push(`plugins[${p.id}]: has recommended=true but is not in ${RECOMMENDED_FILE}. Run: node scripts/sync-recommended.mjs`);
    }
  });
}

if (errors.length) {
  console.error("index.json validation FAILED:\n" + errors.map((s) => "  - " + s).join("\n"));
  process.exit(1);
}
console.log(`index.json OK — ${index.plugins.length} plugins.`);
