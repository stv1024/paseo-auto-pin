# Changelog

## 0.4.2 — 2026-10-09

- Set the current workspace's project rule from the Command Center:
  **Auto-Pin: Always Pin This Project**, **Never Pin This Project**, and
  **This Project Follows Default**. The panel updates immediately.
- Add `OVERVIEW.md`, the listing page for the
  [official Paseo plugin registry](https://paseo.sh/plugins/stv1024/auto-pin),
  and ship it in the npm package.
- Document `paseo plugin add stv1024/auto-pin` for Paseo 0.11 and later.
  npm and GitHub installation remain available for every supported version.
- Update the client and plugin SDKs to **0.11.1**. Verify Paseo **0.9.1**,
  **0.10.2**, and **0.11.1** with the integration suite.
- Record the upstream status of the workspace creation race
  ([getpaseo/paseo#5447](https://github.com/getpaseo/paseo/issues/5447)), which
  is still open in Paseo 0.11.1.

Requires Paseo 0.9.1 or later. Pinning behavior and saved settings are unchanged.

## 0.4.1 — 2026-09-30

- Allow Paseo **>=0.9.1** without an upper version limit,
  so later stable hosts are not rejected solely by their version number.
- Update the client and plugin SDKs to **0.10.2**. Keep SDK dependencies locked
  for repeatable builds while leaving the host requirement open-ended.
- Run the integration suite against the actual installed CLI version instead
  of requiring and reporting 0.9.1. Verify Paseo **0.9.1** and **0.10.2** for
  plugin loading, client compilation, pinning, project rules, and reload.
- Preserve plugin logs when an integration check fails, before stopping the
  test daemon.
- Document the Paseo 0.9.2 creation-response race that can temporarily hide new
  pins, with an isolated reproduction and a candidate host patch for upstream
  review. Reported upstream as
  [getpaseo/paseo#5447](https://github.com/getpaseo/paseo/issues/5447).
  The diagnostic does not change plugin pinning behavior.

## 0.4.0 — 2026-09-24

- Choose **Follow default**, **Always**, or **Never** for each project. Project
  rules apply to new workspaces, including worktrees, and override the default switch.
- Browse and search projects in a refreshed Auto-Pin panel, with a clear preview
  of what each rule does and feedback when settings save or fail.
- Rename the Command Center toggle to **Auto-Pin: Toggle Default** to make its
  scope clear. Existing on/off settings carry over unchanged.
- Preserve concurrent settings changes from multiple clients and prevent late
  refresh responses from replacing a newer selection.
- Rewrite the README for users; add a development guide, community post, and GIF
  recording guide.
- Publish on npm with a dedicated package preparation command; keep the Git
  dependency-install step out of the npm artifact.

Existing pins and archive restoration behave as before. This release does not
automatically unpin workspaces. Requires Paseo 0.9.1–0.9.x.

## 0.3.0 — 2026-09-23

- Target Paseo >=0.9.1 <0.10.0 and pin the client/plugin SDK dependencies to 0.9.1.
- Add a manifest description for Settings → Plugins and document Paseo's new plugin update commands.
- Install locked dependencies through the manifest build step for fresh Git installations and updates.
- Cancel pending pin connections with the workspace lifecycle hook, prevent late handshakes from pinning after cancellation, and bound connection attempts to 5 seconds.
- Refresh panel RPC callbacks when the host replaces them, and prevent overlapping status polls on slow connections.
- Keep existing switch settings and the workspace-created lifecycle behavior; add pin transport and cancellation regression coverage.
- Validate with TypeScript, 20 regression tests, and Paseo 0.9.1's native manifest validator and client/server plugin compiler.
- Add a repeatable isolated daemon integration test; verify actual plugin loading, client bundle delivery, settings preservation, pinning, disabled behavior, archive restoration, concurrent toggles, and reload against Paseo 0.9.1.

## 0.2.0 — 2026-09-14

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
