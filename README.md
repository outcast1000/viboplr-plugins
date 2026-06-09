# Viboplr Plugin Gallery

This repo is an **index only**. It does not host plugin files.

`index.json` lists installable plugins; each entry's `updateUrl` points at that
plugin's own repository, where its files are published as GitHub release zips.
The Viboplr app reads this index to show the gallery, and installs a plugin by
resolving its `updateUrl` → downloading the release zip → installing it (the same
mechanism used for auto-updates).

## Submitting a plugin

You don't edit `index.json` by hand. Instead:

1. **Publish a release** in your plugin's own repo. Its assets must include:
   - `<name>.zip` — with `manifest.json` at the zip **root** (the installer does
     not strip a wrapper folder). The zip is what users actually install, so all
     gallery metadata (name, author, description, icon) is read from the manifest.
   - `update.json` — `{ "version", "file", "minAppVersion"?, "changelog"? }`,
     where `file` is the https URL to the zip.
   - The permanent endpoint is
     `https://github.com/<owner>/<repo>/releases/latest/download/update.json`.
2. **Open a [Submit a plugin](../../issues/new?template=submit-plugin.yml) issue**
   and paste that `update.json` URL. That's the only field you need.
3. A bot **validates the real artifact** — it fetches your `update.json`,
   downloads the zip, reads the root `manifest.json`, cross-checks the id /
   version / `minAppVersion`, and either comments what's wrong or opens a PR that
   adds the derived entry to `index.json`. Comment `/retry` after fixing to
   re-check.
4. A maintainer reviews and **merges the PR** — that publishes your plugin to the
   gallery and to [viboplr.com/plugins](https://viboplr.com/plugins.html).
   Updates afterward are automatic (the app re-checks each `updateUrl` ~daily).

## index.json format (version 2)

```json
{
  "version": 2,
  "plugins": [
    {
      "id": "plugin-id",
      "name": "Display Name",
      "author": "Author",
      "description": "What it does",
      "minAppVersion": "0.7.0",
      "updateUrl": "https://github.com/<owner>/<repo>/releases/latest/download/update.json",
      "installUrl": "https://github.com/<owner>/<repo>/releases/latest/download/<name>.zip",
      "icon": "M… (optional SVG path from manifest)",
      "recommended": false
    }
  ]
}
```

- The plugin's `version` is intentionally **omitted** — the authoritative version
  comes from each plugin's `updateUrl` at install/update time, so a copy here
  would only drift stale.
- `installUrl` is the zip the bot reads from `update.json`'s `file` (the
  permanent `releases/latest/download/<name>.zip`). The website's "Install in
  app" deep link (`viboplr://install-plugin?url=…`) uses it. Because it points at
  `latest`, **a plugin version bump needs no index change** — the same URL just
  resolves to the new release.
- `minAppVersion` is advisory (display + pre-install compatibility hint).
- `recommended` is **curator-controlled** — it is never set from a submission.
  Maintainers flip it in the PR diff to feature a plugin (the app offers
  recommended plugins on first run, and the website highlights them). It is
  preserved across re-submissions.
- Entries are kept sorted: recommended first, then alphabetical by name.

## Maintainer tooling

- `scripts/validate-plugin.mjs` — validates one `updateUrl` end-to-end.
- `scripts/process-submission.mjs` — run by the submission workflow.
- `scripts/validate-index.mjs` — PR gate; structural check of `index.json`.
- `node scripts/lib.test.mjs` — unit tests for the shared helpers.

All scripts are zero-dependency Node 20+ (`unzip` CLI is used to read zips).

## Current plugins

See [`index.json`](index.json) for the live list. Currently: `spotify-browse`,
`tidal-browse`, `p2p-sharing`, `youtube`, `genius`, `auto-tagger`.
