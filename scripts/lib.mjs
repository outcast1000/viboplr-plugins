// Shared helpers for the Viboplr plugin gallery automation.
// Zero npm dependencies — Node 20+ built-ins only (global fetch, node:* modules).

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Parse a GitHub Issue Form body into a { lowercasedLabel: value } map.
 *  Issue forms render as `### Label\n\n<value>` blocks. `_No response_`
 *  (GitHub's empty-field sentinel) is normalized to "". */
export function parseIssueForm(body) {
  const out = {};
  if (!body) return out;
  // Normalize CRLF so the split is stable across platforms.
  const text = body.replace(/\r\n/g, "\n");
  const parts = text.split(/\n###\s+/);
  // First chunk may have a leading "### " (no preceding newline) — strip it.
  parts[0] = parts[0].replace(/^###\s+/, "");
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const label = part.slice(0, nl).trim().toLowerCase();
    let value = part.slice(nl + 1).trim();
    if (value === "_No response_") value = "";
    if (label) out[label] = value;
  }
  return out;
}

/** Compare two dotted numeric versions. Returns -1 / 0 / 1 (a vs b).
 *  Mirrors the lenient numeric comparison the Rust app uses — non-numeric
 *  segments are treated as 0, missing trailing segments as 0. */
export function compareVersions(a, b) {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? "0", 10) || 0;
    const nb = parseInt(pb[i] ?? "0", 10) || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** A plausible semver-ish string: 1, 1.2, or 1.2.3 (numeric segments). */
export function isVersionString(v) {
  return typeof v === "string" && /^\d+(\.\d+){0,3}$/.test(v.trim());
}

/** Fetch a URL and parse JSON, with a clear error on any failure. */
export async function fetchJson(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "viboplr-gallery-bot" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Response from ${url} is not valid JSON`);
  }
}

/** Download a binary URL to a temp file and return its path + a cleanup fn. */
export async function downloadToTemp(url, filename) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "viboplr-gallery-bot" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = mkdtempSync(join(tmpdir(), "vbpl-"));
  const path = join(dir, filename);
  writeFileSync(path, buf);
  return { path, size: buf.length, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** List the entry names inside a zip via the runner's `unzip` CLI. */
export function listZipEntries(zipPath) {
  // `unzip -Z1` prints one entry name per line (no header/footer).
  const out = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Read a single file's text from a zip via `unzip -p` (stdout, no extraction). */
export function readZipFile(zipPath, entry) {
  return execFileSync("unzip", ["-p", zipPath, entry], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/** True if `s` is a plain https URL (no javascript:, data:, etc.). */
export function isHttpsUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Reject strings carrying HTML markup characters. Defense-in-depth — the
 *  browse page also HTML-escapes on render. Spaces/punctuation are allowed. */
export function isCleanText(s) {
  return typeof s === "string" && !/[<>]/.test(s);
}
