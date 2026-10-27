# Developing Auto-Pin

Auto-Pin 0.6.0 requires Paseo **>=0.13.0**, with no upper version limit. The
client uses the runtime translation API (`defineTranslations`, `useTranslation`,
and translated command titles) and imports `Icon` from
`@getpaseo/plugin/client/ui`; Paseo 0.12 and earlier lack these. The
integration suite has been verified with Paseo **0.13.0**, **0.13.1**, and
**0.13.2**. Later stable versions may load without changing the manifest, but
this is not a guarantee that future Paseo API changes will remain compatible.
Auto-Pin 0.5.2 remains the release for Paseo 0.11 and 0.12.

Both Paseo SDK dependencies are pinned to **0.13.0** for repeatable builds; these
dependency pins do not restrict the host's version. The host supplies React and
React Native at runtime. Keep the SDK versions in sync and rerun integration
checks against both the minimum supported host and the latest stable host when
updating them.

The two pins have different roles. `@getpaseo/plugin` is a development
dependency: Paseo resolves it while it compiles the plugin. `@getpaseo/client`
is a **runtime dependency**, because `server/pin.ts` imports `DaemonClient` from
the `@getpaseo/client/internal/daemon-client` subpath. An installation that
installs runtime dependencies must ship a lockfile that fixes the tree, so
`npm-shrinkwrap.json` is committed, listed in `files`, and published. The
registry review rejects a package that declares dependencies without it.

## Local setup

```bash
npm ci
npm run typecheck
npm test
paseo plugin install /path/to/paseo-auto-pin
paseo plugin reload auto-pin
paseo plugin logs auto-pin
```

Git installations and updates run the manifest's `npm ci` build step before
Paseo compiles the plugin. Local-directory installations use `reload` after edits.
Managed npm installations install production dependencies automatically and use
a published manifest without the Git-only build step.

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
   `git tag -a v0.6.0 -m "Auto-Pin 0.6.0" && git push origin v0.6.0`.
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
package in a fresh temporary directory, removes `private` and development scripts,
and omits only the known Git dependency-install command from the staged manifest.
The source repository stays private to npm to prevent accidental direct publishing.
Check that the printed file list contains `npm-shrinkwrap.json`; a tarball without
it is rejected by the registry review.

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

The server registers a `workspace.created` lifecycle hook. For each new,
non-archived workspace, it looks up a rule by the event's `projectId`:

1. **Always** pins the workspace.
2. **Never** skips it.
3. No override uses the saved default.

The hook works without a connected client. It does not scan old workspaces,
respond to archive restoration, or unpin anything. Project names and paths are
display information; matching uses Paseo's project ID, so two projects with the
same display name have independent rules.

The panel reads projects through the public `paseo.projects.list()` API. The list
includes projects with no active workspace. A saved rule stays associated with
its project ID; it does not transfer to a different project created with the same
name or path.

### Settings and concurrent changes

Settings live in `$PASEO_HOME/plugin-data/auto-pin.json`, defaulting to
`~/.paseo/plugin-data/auto-pin.json`:

```json
{
  "enabled": true,
  "projectRules": {
    "example-project-id": "never"
  },
  "revision": 1
}
```

`enabled` is the default, not a master switch. Only overrides are stored;
choosing **Follow default** removes that project's entry.

The old `{"enabled": false}` format loads without migration steps and is not
rewritten until a setting changes. Missing or malformed values use defaults;
invalid rule entries are ignored individually. File access errors are surfaced.

All mutations share one queue. Each save changes only the requested setting,
increments the revision, and replaces the file through a temporary file in the
same directory. The cache updates only after a successful save.

Same-client changes reach the panel through a shared React store. Open panels
refresh settings and the project list every 10 seconds; **Refresh** checks
immediately. Revisions prevent a delayed read from replacing newer settings.
Read errors and save errors are shown separately.

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

Settings are cached by the plugin process. If you edit the JSON manually, reload
the plugin, then reopen the panel. Prefer the panel for normal changes.

### Paseo integration limits

Paseo 0.9.2 through 0.12.x can display an old creation snapshot after the live
pin update; Paseo 0.13.0 fixes this in the app. See
[the known issue, its fix, and the maintenance policy](paseo-workspace-race.md).
Host state synchronization fixes belong upstream. Keep the plugin's creation
hook independent of response timing and preserve manual unpinning.

Paseo 0.13.0's public `PaseoApi` still has no pin mutation, and the
`workspace.create` request has no pin field for a `before` hook to set. The pin adapter uses
`DaemonClient` from `@getpaseo/client/internal/daemon-client` over a short-lived
connection to the local daemon. This is the only internal SDK integration.

The adapter reads `daemon.listen` from Paseo's config and defaults to
`127.0.0.1:6767`. Connection attempts time out after five seconds. Hook cancellation
closes the connection and blocks late handshakes from sending a pin request.
Cancellation cannot undo a request the daemon already accepted.

Paseo's native server settings handle has `read()` and `subscribe()`, but no
write method in 0.13.0, so Auto-Pin retains its own settings file and RPCs.

| RPC | Purpose |
| --- | --- |
| `autopin.ensure` | Read hook status and settings; the name is kept for compatibility. |
| `autopin.toggle` | Toggle the default and return saved settings. |
| `autopin.projects` | List projects for the panel. |
| `autopin.set-project-rule` | Save `default`, `always`, or `never` for one project. |

## Verification

`npm test` covers rule precedence, old settings, concurrent saves, failed writes,
stale client responses, lifecycle cancellation, and the pin transport.

For an integration check against an actual daemon, install its runtime outside
this repository:

```bash
npm install --prefix /path/to/paseo-test-runtime --no-save --ignore-scripts @getpaseo/cli@0.13.2
npm run test:integration -- --runtime /path/to/paseo-test-runtime
```

When the minimum host differs from the latest stable release, repeat with the
minimum version in another runtime directory. To check a future stable release, install
`@getpaseo/cli@latest`. The script reads the installed CLI version and passes
that real version to the daemon, so manifest validation uses the host under
test rather than a hard-coded version.

Git must be available. The script creates a temporary Paseo home, repositories,
and worktrees, using an automatically assigned loopback port. AI providers,
relay, and speech are disabled. It verifies loading and client compilation,
project discovery, rule precedence for real worktrees, settings preservation,
invalid input, archive restoration, concurrent saves, and plugin reload.

The daemon stops at the end. The printed temporary directory retains logs and
test data for inspection. This does not touch your normal Paseo home.

Add `--ui` to keep the test daemon and its bundled web app open after the checks.
Open the printed URL, check the panel, and press Enter in the terminal to stop.
For a fresh managed Git installation, add
`--source https://github.com/stv1024/paseo-auto-pin` after publishing the revision
you want to test.

Before a release, also check the panel at desktop and narrow widths: change
each rule, toggle the default, search, reconnect, and confirm failures leave the
previous selection visible. Check the Command Center with the panel open, and
flip the sidebar header switch while the panel is open and closed. Plugin
commands appear in the Command Center only while a workspace is open. Repeat the
check in Simplified Chinese: set **Settings → General → Language** to 简体中文,
or open the web app in a browser whose language is `zh-CN` while the setting is
**System**. Switch back to English and confirm that the panel, the sidebar
switch, and the command titles change without a reload.

## Files to start with

| File | Responsibility |
| --- | --- |
| `server/lifecycle.ts` | Decide whether to pin each new workspace. |
| `server/store.ts` | Load, save, and resolve project rules. |
| `server/pin.ts` | Version-specific pin transport. |
| `server/handlers.ts` | Settings and project RPC handlers. |
| `shared/contracts.ts` | Shared RPC schemas and types. |
| `client/panel.tsx` | Settings screen. |
| `client/messages.ts`, `client/locales/` | Translated UI text. |
| `client/sidebar.tsx` | Sidebar header row with the default switch. |
| `client/state.ts` | Shared client state and revision handling. |
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

When changing the supported Paseo version, recheck the internal pin adapter,
manifest validation, client/server compilation, and the daemon integration.
