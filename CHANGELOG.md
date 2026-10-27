# Changelog

## 0.6.0 — 2026-10-27

- Translate the panel, the sidebar switch, and the Command Center titles into
  Simplified Chinese. They follow Paseo's app language and change at once when
  it changes. Other languages show English. Search keywords stay in English, and
  every command title still starts with "Auto-Pin".
- Require Paseo **0.13.0** or later (`>=0.13.0`), for the runtime translation
  API. Paseo 0.12 and earlier refuse to install this version; use Auto-Pin
  0.5.2 there. The sidebar race of Paseo 0.11.x and 0.12.x cannot occur with
  this version.
- Import `Icon` from `@getpaseo/plugin/client/ui`. Paseo removes the
  `@getpaseo/plugin/client/react-native` entry after April 20, 2027.
- Update the Paseo SDK (`@getpaseo/plugin`, `@getpaseo/client`) to 0.13.0 and
  `vitest` to 4.1.12.
- Verify Paseo **0.13.0**, **0.13.1**, and **0.13.2** with the integration
  suite, and check the 0.13.1 web app in English and Simplified Chinese.
- No change to pinning or settings. Settings from 0.5.x load unchanged.

## 0.5.2 — 2026-10-26

- Paseo **0.13.0** fixes the sidebar race that could hide a newly applied pin
  ([getpaseo/paseo#7758](https://github.com/getpaseo/paseo/pull/7758), for
  [getpaseo/paseo#5447](https://github.com/getpaseo/paseo/issues/5447)).
  Verified in the 0.13.0 web app with this plugin: local and worktree
  workspaces, with and without an initial message, stay in **Pinned**, and a
  manual unpin still works. Paseo 0.11.x and 0.12.x still have the race; update
  Paseo to remove it.
- Verify Paseo **0.11.1**, **0.12.0**, and **0.13.0** with the integration suite.
- Lock `zod` 4.6.7 in the runtime tree for security advisory
  [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Add a Simplified Chinese registry listing: a `zh-CN` description in the
  manifest's `translations` and `OVERVIEW.zh-CN.md`. Paseo ignores both.
- Publish releases from GitHub Actions with npm **Trusted Publishing**
  (OIDC, `.github/workflows/release.yml`), so no npm token is needed.
- Let the race diagnostic run on any Paseo version instead of only 0.9.2. Add
  `--ui` to keep its daemon and web app open for a check in the app, and
  `--no-hold` to let creation responses return at once.
- No behavior change. Pinning, settings, and the Paseo requirement
  (`>=0.11.0`) are unchanged.

## 0.5.1 — 2026-10-25

- Ship `npm-shrinkwrap.json` inside the published package. npm installations
  now lock `@getpaseo/client` and its runtime tree (`@getpaseo/protocol`,
  `@getpaseo/relay`, `zod`) with resolved sources and integrity. The registry
  review requires a lockfile when an installation installs runtime
  dependencies; 0.5.0 was withheld for that reason
  ([getpaseo/plugins#237](https://github.com/getpaseo/plugins/pull/237)).
- Keep one lockfile in the repository: `package-lock.json` is renamed to
  `npm-shrinkwrap.json`, so the manifest's Git build step (`npm ci`) and the
  published tarball use the same fixed tree.
- No behavior change. Pinning, settings, and the manifest are unchanged.

## 0.5.0 — 2026-10-09

- Add an **Auto-Pin** row to the sidebar header. Its switch turns the default on
  or off in one click; the row opens the panel. The row also picks up changes
  from other clients every minute.
- Move the panel to Paseo 0.11 screens (`addScreen`). Links to the former
  surface keep working because the id is unchanged.
- Add a display name, an icon, and screenshots to the manifest for the plugin
  registry and Paseo's plugin pages.
- Mention the sidebar switch in `OVERVIEW.md`.

Requires **Paseo 0.11.0 or later**. For Paseo 0.9.1 to 0.10.x, stay on 0.4.2.
Pinning behavior and saved settings are unchanged.

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
