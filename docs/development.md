# Developing Auto-Pin

Auto-Pin 0.7.0 requires Paseo **>=0.16.0**, with no upper version limit. It
uses `defineSettings` for its values, `addHook("workspace.create.after")` for
new workspaces, `workspaces.ref(id).setPinned` to pin, and `useProjects` for the
project list. The integration suite has been verified with Paseo **0.16.1**.
Later stable versions may load without changing the manifest, but this is not a
guarantee that future Paseo API changes will remain compatible. Auto-Pin 0.6.0
remains the release for Paseo 0.13 to 0.15.

The plugin has **no runtime dependencies**. The Paseo SDK packages
(`@getpaseo/plugin`, `@getpaseo/client`, `@getpaseo/protocol`) are development
dependencies, pinned to **0.16.1** for repeatable type checks. Paseo supplies the
SDK, `zod`, React, and React Native when it compiles and runs the plugin. Keep
the three SDK versions in sync and rerun the integration check against both the
minimum supported host and the latest stable host when updating them.

Do not add a runtime dependency without a strong reason. A package with
dependencies must ship a lockfile (`npm-shrinkwrap.json`) for the registry
review, and the Git installation then needs an `npm ci` build step.
`scripts/pack-npm.mjs` refuses to pack while `package.json` has `dependencies`
or the manifest has `build`.

## Local setup

```bash
npm ci
npm run typecheck
npm test
paseo plugin install /path/to/paseo-auto-pin
paseo plugin reload auto-pin
paseo plugin logs auto-pin
```

Local-directory installations use `reload` after edits.

## Publishing on npm

Releases are published by
[`.github/workflows/release.yml`](../.github/workflows/release.yml) with npm
**Trusted Publishing** over GitHub OIDC. No npm token is stored in the
repository, in GitHub, or on a machine. npm accepts a publish only when the
repository, the workflow filename, and the tag match the package's trusted
publisher record on npmjs.com.

Release sequence:

1. Bump `version` in `package.json` and add the changelog section.
2. Run the checks and pack the tarball (below).
3. Commit, push `main`, tag the release commit, and push the tag:
   `git tag -a v0.7.0 -m "Auto-Pin 0.7.0" && git push origin v0.7.0`.
   The tag push starts the workflow. A tag that does not match the packed
   version fails the run before it reaches npm.
4. Create the GitHub release from that tag.

### Checks before a release

```bash
npm run typecheck
npm test
npm run pack:npm
```

The command prints the tarball path, integrity, and included files. It stages a
package in a fresh temporary directory and removes `private` and development
scripts. The source repository stays private to npm to prevent accidental direct
publishing.

Install the printed tarball into a separate test directory with
`npm install --prefix /path/to/package-test --ignore-scripts --omit=dev --legacy-peer-deps /path/to/paseo-auto-pin-VERSION.tgz`.
Verify that installed artifact using
`npm run test:integration -- --runtime /path/to/paseo-test-runtime --plugin-directory /path/to/package-test/node_modules/paseo-auto-pin`.
Then run the integration check with `--source npm:paseo-auto-pin@VERSION` after
publication to verify managed npm acquisition. The integration suite is not part
of the workflow: it needs a Paseo runtime and a local daemon, so it runs on a
machine.

### Manual publication

For an emergency, publish the packed tarball by hand with
`npm publish /path/to/paseo-auto-pin-VERSION.tgz --access public --registry=https://registry.npmjs.org/`
after `npm login`. This account has no authenticator app, so npm asks for browser
approval and the request expires after five minutes. The workflow publishes the
same artifact the pack command produces, so a manual release and a CI release are
interchangeable.

## How it works

The server adds a `workspace.create.after` hook. For each new, non-archived
workspace, it reads the settings and looks up a rule by the workspace's
`projectId`:

1. **Always** pins the workspace.
2. **Never** skips it.
3. No override uses the saved default.

It pins with `paseo.workspaces.ref(id).setPinned(true)` from the hook context.
The hook works without a connected client. It does not scan old workspaces,
respond to archive restoration, or unpin anything. Project names and paths are
display information; matching uses Paseo's project ID, so two projects with the
same display name have independent rules.

The panel lists projects with `useProjects({ hosts: [host.id] })` and reads each
row with `useProject(ref)`. The list includes projects with no active workspace
and updates by itself. A saved rule stays associated with its project ID; it
does not transfer to a different project created with the same name or path.

### Settings

`shared/settings.ts` defines one settings document, `autopin`, with host scope:

```json
{
  "enabled": true,
  "projectRules": {
    "example-project-id": "never"
  }
}
```

`enabled` is the default, not a master switch. Only overrides are stored;
choosing **Follow default** removes that project's entry. Paseo stores the
document in `$PASEO_HOME/plugin-settings/auto-pin/autopin.json`, validates every
write against the schema, and rejects a write whose revision is stale.

The panel and the sidebar switch use `useSettings`. Paseo pushes each saved
change to every connected client, so nothing polls. The Command Center items
cannot use hooks, so `client/settings.ts` reads and writes through
`settingsRpc("autopin")`, and reads again once after a revision conflict.

An invalid stored document (for example a hand edit that breaks the schema)
shows an error and a **Reset to defaults** button in the panel. The hook pins
nothing while the document is invalid.

### Upgrade from 0.6 and earlier

Auto-Pin 0.6 and earlier kept the same two values in
`$PASEO_HOME/plugin-data/auto-pin.json`. The server's settings handle has only
`read()` and `subscribe()`, so the server cannot write the settings document
itself. The upgrade works in three parts:

1. While the settings document does not exist (its revision is `"missing"`), the
   hook reads the old file. Pinning keeps the old behavior from the first second.
2. The client entry calls `importLegacy`: when the revision is `"missing"`, it
   gets the old values from the `autopin.legacy` RPC and writes them against the
   revision `"missing"`. Paseo rejects that write when another client saved
   first, so an existing document is never overwritten.
3. When the settings document exists (at start, or on the first change), the
   server deletes the old file.

### Translations

Every visible string except the product name "Auto-Pin" comes from
`client/locales/en.json`, with a Simplified Chinese copy in
`client/locales/zh-CN.json`. `client/messages.ts` registers both with
`defineTranslations`. Paseo selects the resource from its app language and
falls back to English for other languages and for missing keys. Components
read text with `useTranslation(messages)`, so a language change re-renders an
open panel and the sidebar switch. Command titles use `messages.message(key)`,
which Paseo resolves when it renders the Command Center.

When the client module loads, the SDK throws if `zh-CN.json` has a key that
`en.json` lacks, or a message whose placeholders differ from the English one. A
command title with an unknown key throws too. Either error stops the whole
client, not one label. `npm test` loads the resources, checks that
`zh-CN.json` has exactly the English keys, and checks that every command title
starts with "Auto-Pin". Keep the product name first: the Command Center ranks
matches by their position in the title, so all languages sort the plugin's
commands together. Search keywords stay in English.

Keep messages as data and translate them when they render. For example, the
panel stores the last saved rule, not a sentence, so its status line follows a
language change.

### RPCs

| RPC | Purpose |
| --- | --- |
| `settings.autopin.read` / `.write` / `.reset` | Paseo's settings RPCs for the `autopin` document. |
| `autopin.legacy` | The values of the 0.6 file while the settings document does not exist, else `null`. |

## Verification

`npm test` covers rule precedence, the settings defaults, the 0.6 file (read,
damaged, removed), the one-time import, conflict handling for Command Center
writes, and the hook (archived workspaces, cancellation, failures, invalid
settings).

For an integration check against an actual daemon, install its runtime outside
this repository:

```bash
npm install --prefix /path/to/paseo-test-runtime --no-save --ignore-scripts @getpaseo/cli@0.16.1 pino
npm run test:integration -- --runtime /path/to/paseo-test-runtime
```

When the minimum host differs from the latest stable release, repeat with the
minimum version in another runtime directory. To check a future stable release, install
`@getpaseo/cli@latest`. The script reads the installed CLI version and passes
that real version to the daemon, so manifest validation uses the host under
test rather than a hard-coded version.

Git must be available. The script creates a temporary Paseo home with a 0.6
settings file, repositories, and worktrees, using an automatically assigned
loopback port. AI providers, relay, and speech are disabled. It verifies loading
and client compilation, the 0.6 file before and after the import, the removal of
the old file, rule precedence for real worktrees, invalid input, archive
restoration, concurrent saves, and plugin reload.

The daemon stops at the end. The printed temporary directory retains logs and
test data for inspection. This does not touch your normal Paseo home.

Add `--ui` to keep the test daemon and its bundled web app open after the checks.
Open the printed URL, check the panel, and press Enter in the terminal to stop.
For a fresh managed Git installation, add
`--source https://github.com/stv1024/paseo-auto-pin` after publishing the revision
you want to test.

Before a release, also check the panel at desktop and narrow widths: change
each rule, toggle the default, and search. Open the panel in two windows and
confirm that a change in one shows in the other. Check the Command Center with
the panel open, and flip the sidebar header switch while the panel is open and
closed. Plugin commands that act on a project appear in the Command Center only
while a workspace is open. Repeat the check in Simplified Chinese: set
**Settings → General → Language** to 简体中文, or open the web app in a browser
whose language is `zh-CN` while the setting is **System**. Switch back to
English and confirm that the panel, the sidebar switch, and the command titles
change without a reload.

## Files to start with

| File | Responsibility |
| --- | --- |
| `shared/settings.ts` | Settings document, rule helpers, and the `autopin.legacy` RPC. |
| `server/lifecycle.ts` | Decide whether to pin each new workspace, and pin it. |
| `server/legacy.ts` | Read and delete the 0.6 settings file. |
| `client/panel.tsx` | Auto-Pin screen with the default and the project rules. |
| `client/sidebar.tsx` | Sidebar header row with the default switch. |
| `client/settings.ts` | Command Center writes and the one-time import. |
| `client/messages.ts`, `client/locales/` | Translated UI text. |
| `index.server.ts` / `index.client.tsx` | Register contributions. |
| `assets/` | Registry icon and screenshots referenced by the manifest. |
| `scripts/integration.mjs` | Isolated daemon verification. |

## Registry listing

The [official registry](https://github.com/getpaseo/plugins) lists Auto-Pin as
`stv1024/auto-pin` and pins an exact npm version. After a new npm release, the
registry bot opens a bump pull request; a maintainer reviews it before the listing
changes. `OVERVIEW.md` is the listing page shown inside Paseo. It must ship at the
package root beside `paseo-plugin.json`, must not contain installation commands,
and should be updated whenever plugin behavior changes.

The manifest's `translations` and `OVERVIEW.zh-CN.md` give the listing in
Simplified Chinese. Only the registry reads them; Paseo ignores both. When
`OVERVIEW.md` or the manifest `description` changes, update the translation in
the same change. `OVERVIEW.zh-CN.md` is a complete page, not a partial override,
and has the same rules as `OVERVIEW.md`.

When changing the supported Paseo version, recheck manifest validation,
client/server compilation, and the daemon integration.
