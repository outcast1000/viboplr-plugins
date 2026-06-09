// Runs inside the "Submit a plugin" GitHub Action.
//
// Reads the submission issue, validates the plugin (via validate-plugin.mjs),
// then EITHER comments the errors back on the issue, OR opens a PR that splices
// the derived entry into index.json. Approval == a maintainer merging that PR.
//
// Env (provided by the workflow):
//   ISSUE_NUMBER, ISSUE_BODY, ISSUE_USER, GITHUB_TOKEN, GITHUB_REPOSITORY
//
// Uses the `gh` CLI + git, both present on github-hosted runners. No npm deps.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseIssueForm } from "./lib.mjs";
import { validatePlugin } from "./validate-plugin.mjs";
import { applyRecommended, readRecommendedIds } from "./recommended.mjs";

const INDEX = "index.json";

const issueNumber = process.env.ISSUE_NUMBER;
const issueBody = process.env.ISSUE_BODY || "";
const issueUser = process.env.ISSUE_USER || "a contributor";

function gh(args, opts = {}) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });
}
function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}
function comment(markdown) {
  gh(["issue", "comment", issueNumber, "--body", markdown]);
}
function label(name) {
  // Best-effort; never fail the run over a missing label.
  try {
    gh(["issue", "edit", issueNumber, "--add-label", name]);
  } catch {}
}

function fmtList(items) {
  return items.map((s) => `- ${s}`).join("\n");
}

const form = parseIssueForm(issueBody);
// The form has a single load-bearing field; accept a few label spellings.
const updateUrl = (form["plugin update.json url"] || form["update url"] || form["updateurl"] || "").trim();

console.log("Parsed updateUrl:", updateUrl || "(none)");

const result = await validatePlugin(updateUrl);

if (!result.ok) {
  let body = `### ❌ Validation failed\n\nThanks @${issueUser}! Your plugin submission couldn't be validated yet:\n\n`;
  body += fmtList(result.errors);
  if (result.warnings.length) body += `\n\n**Warnings**\n${fmtList(result.warnings)}`;
  body +=
    `\n\nFix the issues above, then comment \`/retry\` (or edit the issue) and I'll re-check. ` +
    `See the [submission guide](README.md#submitting-a-plugin).`;
  comment(body);
  label("needs-changes");
  console.log("Validation failed — commented on issue.");
  process.exit(0);
}

const entry = result.entry;

// --- splice into index.json (dedup by id) ---
const index = JSON.parse(readFileSync(INDEX, "utf8"));
if (!Array.isArray(index.plugins)) throw new Error("index.json is malformed: plugins[] missing");

const existingIdx = index.plugins.findIndex((p) => p.id === entry.id);
const isUpdate = existingIdx !== -1;
// The bot never sets `recommended` from a submission — it's derived from
// recommended.json (the curator's single source of truth) below.
delete entry.recommended;
if (isUpdate) {
  index.plugins[existingIdx] = entry;
} else {
  index.plugins.push(entry);
}
// Derive recommended flags + canonical sort from recommended.json.
applyRecommended(index, readRecommendedIds());
writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");

// --- open the PR ---
const branch = `submission/plugin-${entry.id}-issue-${issueNumber}`;
git(["config", "user.name", "viboplr-gallery-bot"]);
git(["config", "user.email", "bot@viboplr.com"]);
git(["checkout", "-B", branch]);
git(["add", INDEX]);
const verb = isUpdate ? "Update" : "Add";
git(["commit", "-m", `${verb} ${entry.name} (${entry.id}) to plugin gallery\n\nCloses #${issueNumber}`]);
git(["push", "-f", "origin", branch]);

let warnBlock = "";
if (result.warnings.length) warnBlock = `\n\n**Warnings (non-blocking)**\n${fmtList(result.warnings)}`;

const prBody =
  `Automated submission from #${issueNumber} by @${issueUser}.\n\n` +
  `**${verb}:** \`${entry.id}\` — ${entry.name} by ${entry.author}\n\n` +
  "```json\n" +
  JSON.stringify(entry, null, 2) +
  "\n```\n" +
  `\nValidated against the live \`update.json\` and the zip's root \`manifest.json\`.${warnBlock}\n\n` +
  `Merging publishes it to the gallery. To feature it, add \`"recommended": true\` before merge.\n\n` +
  `Closes #${issueNumber}`;

const prTitle = `${verb} ${entry.name} (${entry.id})`;
let prUrl = "";
try {
  prUrl = gh(["pr", "create", "--title", prTitle, "--body", prBody, "--head", branch, "--base", "main"]).trim();
} catch {
  // A PR for this branch may already exist (re-submission) — find it.
  prUrl = gh(["pr", "list", "--head", branch, "--json", "url", "--jq", ".[0].url"]).trim();
}

let okBody = `### ✅ Validated\n\nThanks @${issueUser}! Your plugin passed validation and a PR is open: ${prUrl}\n\nA maintainer will review and merge it.`;
if (result.warnings.length) okBody += `\n\n**Warnings (non-blocking)**\n${fmtList(result.warnings)}`;
comment(okBody);
label("validated");
console.log("Opened/updated PR:", prUrl);
