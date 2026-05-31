# Viboplr Plugin Gallery

This repo is an **index only**. It does not host plugin files.

`index.json` lists installable plugins; each entry's `updateUrl` points at that
plugin's own repository, where its files are published as GitHub release zips.
The Viboplr app reads this index to show the gallery, and installs a plugin by
resolving its `updateUrl` → downloading the release zip → installing it (the same
mechanism used for auto-updates).

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
      "updateUrl": "https://github.com/<owner>/<repo>/releases/latest/download/update.json"
    }
  ]
}
```

The plugin's `version` is intentionally omitted here — the authoritative
version comes from each plugin's `updateUrl` at install/update time, so a copy
in this index would only drift stale. `minAppVersion` is advisory (for display
and pre-install compatibility hints). Every plugin entry must have an
`updateUrl`.

## Current plugins

| id | repo |
|----|------|
| `spotify-browse` | `outcast1000/viboplr-spotify` |
| `tidal-browse` | `outcast1000/viboplr-tidal` |
| `p2p-sharing` | `outcast1000/viboplr-p2p` |
