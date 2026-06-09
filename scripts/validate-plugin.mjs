// Validate a plugin submission by inspecting the *real* installable artifact.
//
// Given an updateUrl (the only thing an author must provide), this mirrors what
// the Viboplr app does at install time:
//   1. fetch update.json  -> { version, file, minAppVersion?, changelog? }
//   2. download the `file` zip
//   3. read manifest.json at the zip ROOT (the installer does NOT strip a folder)
//   4. cross-check id/version/minAppVersion and derive the gallery index entry
//
// Returns { ok, errors[], warnings[], entry } where `entry` is the object to
// splice into index.json's `plugins[]` on success.

import {
  fetchJson,
  downloadToTemp,
  listZipEntries,
  readZipFile,
  isHttpsUrl,
  isVersionString,
  isCleanText,
} from "./lib.mjs";

const MANIFEST_AT_ROOT = "manifest.json";

export async function validatePlugin(updateUrl) {
  const errors = [];
  const warnings = [];

  if (!isHttpsUrl(updateUrl)) {
    errors.push(`updateUrl must be an https URL (got: ${updateUrl || "empty"}).`);
    return { ok: false, errors, warnings, entry: null };
  }
  if (!/\.json($|\?)/i.test(updateUrl)) {
    warnings.push("updateUrl does not end in .json — expected a link to update.json.");
  }

  // --- 1. update.json ---
  let update;
  try {
    update = await fetchJson(updateUrl);
  } catch (e) {
    errors.push(`Could not fetch update.json: ${e.message}`);
    return { ok: false, errors, warnings, entry: null };
  }

  if (!update || typeof update !== "object") {
    errors.push("update.json did not parse to an object.");
    return { ok: false, errors, warnings, entry: null };
  }
  if (!isVersionString(update.version)) {
    errors.push(`update.json "version" is missing or not numeric (got: ${update.version}).`);
  }
  if (!isHttpsUrl(update.file)) {
    errors.push(`update.json "file" must be an https URL to the plugin zip (got: ${update.file}).`);
  }
  if (update.minAppVersion != null && !isVersionString(update.minAppVersion)) {
    errors.push(`update.json "minAppVersion" must be numeric if present (got: ${update.minAppVersion}).`);
  }
  if (errors.length) return { ok: false, errors, warnings, entry: null };

  // --- 2. download zip ---
  let dl;
  try {
    dl = await downloadToTemp(update.file, "plugin.zip");
  } catch (e) {
    errors.push(`Could not download the plugin zip from update.json "file": ${e.message}`);
    return { ok: false, errors, warnings, entry: null };
  }

  try {
    const MAX_ZIP = 25 * 1024 * 1024;
    if (dl.size > MAX_ZIP) {
      warnings.push(`Plugin zip is large (${(dl.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    // --- 3. manifest.json at root ---
    let entries;
    try {
      entries = listZipEntries(dl.path);
    } catch (e) {
      errors.push(`Zip could not be read: ${e.message}`);
      return { ok: false, errors, warnings, entry: null };
    }
    if (!entries.includes(MANIFEST_AT_ROOT)) {
      const wrapped = entries.find((e) => /(^|\/)manifest\.json$/.test(e));
      if (wrapped) {
        errors.push(
          `manifest.json must be at the ZIP ROOT, but it's at "${wrapped}". ` +
            `The installer does not strip a wrapper folder — zip the files, not the folder.`,
        );
      } else {
        errors.push("Zip has no manifest.json.");
      }
      return { ok: false, errors, warnings, entry: null };
    }
    if (!entries.includes("index.js") && !entries.some((e) => e === "index.js")) {
      warnings.push("Zip has no index.js at root — plugin will not execute.");
    }

    let manifest;
    try {
      manifest = JSON.parse(readZipFile(dl.path, MANIFEST_AT_ROOT));
    } catch (e) {
      errors.push(`manifest.json is not valid JSON: ${e.message}`);
      return { ok: false, errors, warnings, entry: null };
    }

    // --- 4. cross-checks & derive entry ---
    const id = String(manifest.id || "").trim();
    if (!id) {
      errors.push('manifest.json is missing "id".');
    } else if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      errors.push(`Plugin id "${id}" must be lowercase letters, digits, and hyphens.`);
    }
    if (!manifest.name || !isCleanText(manifest.name)) {
      errors.push('manifest.json "name" is missing or contains markup.');
    }
    if (!manifest.author || !isCleanText(manifest.author)) {
      errors.push('manifest.json "author" is missing or contains markup.');
    }
    if (!manifest.description || !isCleanText(manifest.description)) {
      errors.push('manifest.json "description" is missing or contains markup.');
    }
    if (!isVersionString(manifest.version)) {
      errors.push(`manifest.json "version" is missing or not numeric (got: ${manifest.version}).`);
    } else if (update.version !== manifest.version) {
      warnings.push(
        `manifest.json version (${manifest.version}) differs from update.json version (${update.version}). ` +
          `The app installs the zip, so manifest.version is what users get.`,
      );
    }
    // The manifest's own updateUrl should point back at the submitted one, so
    // the app's auto-updater keeps working after install.
    if (manifest.updateUrl && manifest.updateUrl !== updateUrl) {
      warnings.push(
        `manifest.json updateUrl (${manifest.updateUrl}) differs from the submitted updateUrl. ` +
          `Auto-update uses the manifest's value.`,
      );
    }

    if (errors.length) return { ok: false, errors, warnings, entry: null };

    // Index entry shape matches the LIVE index.json exactly (no display-only
    // "version" field — that was dropped in commit ab8e402; the real version is
    // resolved from update.json at install time).
    const entry = {
      id,
      name: String(manifest.name).trim(),
      author: String(manifest.author).trim(),
      description: String(manifest.description).trim(),
      ...(manifest.minAppVersion || update.minAppVersion
        ? { minAppVersion: String(manifest.minAppVersion || update.minAppVersion) }
        : {}),
      updateUrl,
      // installUrl is the zip from update.json's "file" — a permanent
      // releases/latest/download/<name>.zip pointer that tracks the newest
      // release, so version bumps need no index change. The website's
      // "Install in app" deep link (viboplr://install-plugin?url=...) uses it.
      installUrl: String(update.file),
      // recommended is curator-controlled — never set from a submission.
    };
    if (manifest.icon && isCleanText(manifest.icon)) entry.icon = String(manifest.icon);

    return { ok: true, errors, warnings, entry };
  } finally {
    dl.cleanup();
  }
}
