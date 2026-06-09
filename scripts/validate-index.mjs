// CI gate: validate the structural integrity of index.json on every PR.
// This catches manual edits (not just bot-opened PRs). It does NOT re-download
// every plugin zip — that would be slow and rate-limit-prone. It checks shape,
// uniqueness, and field hygiene. Exits non-zero on any error.

import { readFileSync } from "node:fs";
import { isHttpsUrl, isVersionString, isCleanText } from "./lib.mjs";

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
}

if (errors.length) {
  console.error("index.json validation FAILED:\n" + errors.map((s) => "  - " + s).join("\n"));
  process.exit(1);
}
console.log(`index.json OK — ${index.plugins.length} plugins.`);
