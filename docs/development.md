# Developing Auto-Pin

Auto-Pin 0.4 targets Paseo **>=0.9.1 <0.10.0**. Both Paseo SDK dependencies are
pinned to 0.9.1. The host supplies React and React Native at runtime.

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

Settings are cached by the plugin process. If you edit the JSON manually, reload
the plugin, then reopen the panel. Prefer the panel for normal changes.

### Paseo integration limits

Paseo 0.9.1's public `PaseoApi` has no pin mutation. The pin adapter uses
`DaemonClient` from `@getpaseo/client/internal/daemon-client` over a short-lived
connection to the local daemon. This is the only internal SDK integration.

The adapter reads `daemon.listen` from Paseo's config and defaults to
`127.0.0.1:6767`. Connection attempts time out after five seconds. Hook cancellation
closes the connection and blocks late handshakes from sending a pin request.
Cancellation cannot undo a request the daemon already accepted.

Paseo's native server settings handle has `read()` and `subscribe()`, but no
write method in 0.9.1, so Auto-Pin retains its own settings file and RPCs.

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
npm install --prefix /path/to/paseo-test-runtime --no-save --ignore-scripts @getpaseo/cli@0.9.1
npm run test:integration -- --runtime /path/to/paseo-test-runtime
```

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
previous selection visible. Check the Command Center with the panel open.

## Files to start with

| File | Responsibility |
| --- | --- |
| `server/lifecycle.ts` | Decide whether to pin each new workspace. |
| `server/store.ts` | Load, save, and resolve project rules. |
| `server/pin.ts` | Version-specific pin transport. |
| `server/handlers.ts` | Settings and project RPC handlers. |
| `shared/contracts.ts` | Shared RPC schemas and types. |
| `client/panel.tsx` | Settings interface. |
| `client/state.ts` | Shared client state and revision handling. |
| `index.server.ts` / `index.client.tsx` | Register contributions. |
| `scripts/integration.mjs` | Isolated daemon verification. |

When changing the supported Paseo version, recheck the internal pin adapter,
manifest validation, client/server compilation, and the daemon integration.