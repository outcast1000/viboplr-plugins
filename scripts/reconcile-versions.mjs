// Sync each plugin entry's display `version` / `minAppVersion` in index.json
// from its live update.json (the single source of truth). Run:
//   node scripts/reconcile-versions.mjs           # apply + write index.json
//   node scripts/reconcile-versions.mjs --check    # verify in sync, write nothing (CI)
//
// Idempotent. A broken plugin (update.json unreachable-404 / malformed /
// non-numeric version) is a HARD error: the process exits non-zero so the
// scheduled job goes red — but valid entries are still written first, so the
// commit step lands the good syncs. Transient failures (network / 5xx) are
// warnings only and never touch the entry or fail the run.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fetchJson } from "./lib.mjs";
import { planEntryUpdate, applyPlan } from "./reconcile.mjs";

const INDEX = "index.json";
const check = process.argv.includes("--check");

const index = JSON.parse(readFileSync(INDEX, "utf8"));
if (!Array.isArray(index.plugins)) {
  console.error("index.json is malformed: plugins[] missing");
  process.exit(1);
}

const rows = [];
let changedCount = 0;
let hardErrors = 0;

for (const p of index.plugins) {
  const id = p.id || "(no id)";
  if (!p.updateUrl) {
    rows.push({ id, status: "skipped (no updateUrl)" });
    continue;
  }

  let update;
  try {
    update = await fetchJson(p.updateUrl);
  } catch (e) {
    // fetchJson throws on non-2xx and on invalid JSON. A 404 means the release
    // is genuinely gone (hard); anything else is treated as transient (warn).
    if (/HTTP 404/.test(e.message)) {
      hardErrors++;
      rows.push({ id, status: `❌ ${e.message}` });
    } else {
      rows.push({ id, status: `⚠️ ${e.message} (transient)` });
    }
    continue;
  }

  const { changes, errors } = planEntryUpdate(p, update);
  if (errors.length) {
    hardErrors++;
    rows.push({ id, status: `❌ ${errors.join("; ")}` });
    continue;
  }

  const before = { version: p.version, minAppVersion: p.minAppVersion };
  if (applyPlan(p, changes)) {
    changedCount++;
    const parts = [];
    if ("version" in changes) parts.push(`version ${before.version ?? "-"} → ${p.version}`);
    if ("minAppVersion" in changes)
      parts.push(`minApp ${before.minAppVersion ?? "-"} → ${p.minAppVersion}`);
    rows.push({ id, status: `✅ ${parts.join(", ")}` });
  } else {
    rows.push({ id, status: "up to date" });
  }
}

// Console report
console.log(`\nReconcile versions: ${changedCount} changed, ${hardErrors} error(s)`);
for (const r of rows) console.log(`  ${String(r.id).padEnd(18)} ${r.status}`);

// GitHub step summary (when running in Actions)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Gallery version reconcile\n\n` +
      `**${changedCount}** synced · **${hardErrors}** error(s)${check ? " · _check mode_" : ""}\n\n` +
      `| Plugin | Result |\n|---|---|\n` +
      rows.map((r) => `| \`${r.id}\` | ${r.status} |`).join("\n") +
      "\n",
  );
}

if (check) {
  // CI verify: fail if anything would change (or is broken). Never writes.
  if (changedCount > 0) {
    console.error(
      `\n✗ index.json is out of sync with live update.json.\n` +
        `  Run: node scripts/reconcile-versions.mjs`,
    );
    process.exit(1);
  }
  process.exit(hardErrors > 0 ? 1 : 0);
}

// Apply mode: write the good syncs regardless of hard errors, then reflect
// hard errors in the exit code so the scheduled run flags broken entries.
if (changedCount > 0) {
  writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
  console.log("\nWrote index.json");
} else {
  console.log("\nindex.json already in sync — nothing to write");
}
process.exit(hardErrors > 0 ? 1 : 0);
