# paseo-auto-pin

A [Paseo](https://paseo.sh) plugin that automatically pins newly created
workspaces to the top of the sidebar.

![Auto-Pin panel](docs/screenshot.png)

## Features

- Pins workspaces through the daemon's `workspace.created` lifecycle hook,
  without requiring a client or the panel to be open.
- Existing workspaces and unarchive updates do not trigger auto-pin.
- Sidebar **Auto-Pin** panel and Command Center **Auto-Pin: Toggle** /
  **Auto-Pin: Open Panel** commands.
- Persistent switch in `$PASEO_HOME/plugin-data/auto-pin.json`, defaulting to
  `~/.paseo/plugin-data/auto-pin.json`. Enabled by default; existing settings
  survive the upgrade.
- Same-client toggles update the panel immediately; a 10-second poll reconciles
  changes from other clients. Concurrent server toggles are serialized.

## Installation

```bash
paseo plugin install https://github.com/stv1024/paseo-auto-pin
```

Git installation and updates run the manifest's `npm ci` step to install locked
dependencies before Paseo compiles the plugin. Node.js/npm must be available on
the daemon host.

Paseo 0.9 adds built-in updates for plugins installed from Git or npm. Once a
new plugin revision is published, review and apply it with:

```bash
paseo plugin update auto-pin --check
paseo plugin update auto-pin
```

Local-directory installations use `paseo plugin reload auto-pin` after editing.

## Compatibility and migration

Version **0.3.0** targets **Paseo >=0.9.1 <0.10.0**, using the **0.9.1** SDK.
Paseo 0.8 users should keep plugin version 0.2.0; Paseo 0.7 users should keep
plugin version 0.1.0.

Paseo 0.8 requires a `requirements.paseo` manifest declaration, separate
`index.server.ts` / `index.client.tsx` entry points, and modules under
`server/`, `client/`, or `shared/`. The old single-entry plugin will not load.

The native lifecycle hook replaces workspace stream subscriptions, startup
snapshots, creation-time heuristics, and reads of Paseo's workspace database.
No startup RPC is needed to activate auto-pin. The `autopin.ensure` RPC name
is retained for status reads; it no longer starts a watcher.

The public `PaseoApi` still has no pin mutation in 0.9.1. Pinning therefore
uses `DaemonClient` from `@getpaseo/client/internal/daemon-client`, via a
short-lived connection to the local daemon's WebSocket endpoint. The internal
SDK dependency is pinned to 0.9.1; recheck this integration for future Paseo
releases. The adapter reads `daemon.listen` from the Paseo config and defaults
to `127.0.0.1:6767`, retaining the existing loopback connection behavior.
Connection attempts time out after 5 seconds. Hook cancellation closes the
connection and prevents a late handshake from sending a pin request. A pin
request already accepted by the daemon cannot be undone by cancellation.

The panel refreshes its RPC callbacks when the host replaces them on reconnect,
and avoids overlapping status polls on slow connections. Paseo 0.9's native
server settings handle offers `read()` and `subscribe()`, but no write method;
the existing persisted switch and serialized toggle RPC remain in use.

## Development

```bash
npm ci
npm run typecheck
npm test
paseo plugin install /path/to/paseo-auto-pin
paseo plugin reload auto-pin
paseo plugin logs auto-pin
```

`react` and `react-native` are supplied by the host at runtime.

An optional integration test runs the actual Paseo 0.9.1 daemon. Install its
runtime outside this project, then run:

```bash
npm install --prefix /path/to/paseo-test-runtime --no-save --ignore-scripts @getpaseo/cli@0.9.1
npm run test:integration -- --runtime /path/to/paseo-test-runtime
```

The test uses a fresh temporary `PASEO_HOME`, an automatically assigned loopback
port, and temporary workspaces. It verifies plugin loading, the client bundle,
existing settings, automatic pinning, disabled behavior, archive restoration,
concurrent toggles, and plugin reload. AI providers, relay, and speech are disabled.
The daemon is stopped afterward; the printed temporary directory retains logs
and test data for inspection. This tests the daemon integration, not the panel UI.

To also verify a fresh managed Git installation, add
`--source https://github.com/stv1024/paseo-auto-pin` to the integration command.

| File | Role |
| --- | --- |
| `index.server.ts` | RPC and lifecycle registration |
| `index.client.tsx` | Sidebar surface and commands |
| `shared/contracts.ts` | RPC contracts |
| `server/lifecycle.ts` | Workspace-created hook and cleanup |
| `server/pin.ts` | Version-specific pin transport |
| `server/store.ts` | Persistent switch and serialized toggles |
| `client/panel.tsx` | Sidebar panel |
| `client/state.ts` | Shared state for panel and commands |
| `tests/` | Lifecycle, pin transport, and persistence regression tests |
| `scripts/integration.mjs` | Isolated Paseo 0.9.1 daemon integration test |

## License

MIT
