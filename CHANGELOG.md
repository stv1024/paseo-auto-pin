# Changelog

## 0.2.0 ? 2026-09-14

- Migrate to the Paseo 0.8 manifest, split entry points, directory boundaries, and SDK imports.
- Replace the workspace watcher and timestamp heuristics with the native `workspace.created` hook, active without a connected client.
- Preserve existing switch settings; serialize concurrent toggles and only update cached settings after a successful write.
- Report hook registration status in the panel and add lifecycle/persistence regression tests.
- Verify loading and automatic pinning against the local Paseo 0.8.0 daemon.

## 0.1.0 — 2026-09-07

Initial release.

- Auto-pin newly created workspaces via a daemon-side workspace watcher;
  unarchived workspaces are not re-pinned.
- Persistent on/off switch in `~/.paseo/plugin-data/auto-pin.json`.
- Sidebar **Auto-Pin** panel with live state, watcher status, and a toggle
  button.
- Command Center entries: `Auto-Pin: Toggle` and `Auto-Pin: Open Panel`.
