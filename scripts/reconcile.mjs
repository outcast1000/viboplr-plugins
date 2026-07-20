// Pure logic for reconciling a gallery entry's display metadata against its
// plugin's live update.json. No I/O — imported by the runner
// (reconcile-versions.mjs) and the tests (reconcile.test.mjs).
//
// The gallery index stores `version` / `minAppVersion` as DISPLAY metadata only
// (the app resolves the authoritative values from update.json at install). We
// keep those two fields honest so the Extensions list shows the real current
// version and app-version requirement before install.

import { isVersionString } from "./lib.mjs";

/** Decide how a single index entry should change to match its live update.json.
 *  Returns { changes, errors }:
 *    - changes: subset of { version, minAppVersion } that differ from the entry
 *    - errors:  non-empty when update.json is broken (caller should hard-fail)
 *  A missing `minAppVersion` in update.json is left as-is on the entry (a plugin
 *  may omit it upstream while the gallery still wants to show a floor). */
export function planEntryUpdate(entry, update) {
  const errors = [];
  const changes = {};

  if (!update || !isVersionString(update.version)) {
    errors.push(`update.json "version" missing or not numeric (got: ${update?.version})`);
    return { changes, errors };
  }
  if (entry.version !== update.version) changes.version = update.version;

  if (update.minAppVersion != null) {
    if (!isVersionString(update.minAppVersion)) {
      errors.push(`update.json "minAppVersion" not numeric (got: ${update.minAppVersion})`);
    } else if (entry.minAppVersion !== update.minAppVersion) {
      changes.minAppVersion = update.minAppVersion;
    }
  }

  return { changes, errors };
}

/** Apply a `planEntryUpdate` result to an entry in place. `version` is inserted
 *  after `description` (matching GalleryPluginEntry field order) when new;
 *  updated in place when it already exists. `minAppVersion` is updated in place
 *  (or appended if the entry somehow lacked it). Key order is otherwise
 *  preserved so diffs stay minimal. Returns true if anything changed. */
export function applyPlan(entry, changes) {
  let changed = false;

  if ("minAppVersion" in changes) {
    entry.minAppVersion = changes.minAppVersion;
    changed = true;
  }

  if ("version" in changes) {
    changed = true;
    if ("version" in entry) {
      entry.version = changes.version;
    } else {
      const rebuilt = {};
      for (const [k, v] of Object.entries(entry)) {
        rebuilt[k] = v;
        if (k === "description") rebuilt.version = changes.version;
      }
      if (!("version" in rebuilt)) rebuilt.version = changes.version; // no description key
      for (const k of Object.keys(entry)) delete entry[k];
      Object.assign(entry, rebuilt);
    }
  }

  return changed;
}
