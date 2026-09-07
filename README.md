# paseo-auto-pin

A [Paseo](https://paseo.sh) plugin that automatically pins newly created
workspaces, so active work is always at the top of the sidebar without the
manual pin step.

![Auto-Pin panel](docs/screenshot.png)

## Features

- **Auto-pin on create** — watches the daemon's workspace stream and pins new
  workspaces within a second or two of creation.
- **New workspaces only** — unarchiving an old workspace does not pin it. The
  watcher compares each workspace's `createdAt` against its own start time,
  plus an in-memory seen set.
- **Sidebar panel** — a live **Auto-Pin** panel shows the current
  enabled/disabled state and watcher status, with a toggle button.
- **Command Center** — `Auto-Pin: Toggle` flips the switch,
  `Auto-Pin: Open Panel` jumps to the panel (Ctrl+K).
- **Persistent state** — the switch survives restarts, stored in
  `~/.paseo/plugin-data/auto-pin.json` (default: enabled).

## Installation

```bash
paseo plugin install https://github.com/stv1024/paseo-auto-pin
```

Then open the **Auto-Pin** entry in the sidebar, or hit Ctrl+K and type
`auto`.

## Compatibility

Built and tested against **Paseo 0.7.2**.

The plugin-injected `PaseoApi` has no pin mutation in 0.7.2, so pinning uses a
short-lived `DaemonClient` from `@getpaseo/client/internal/daemon-client`
connecting to `ws://<daemon.listen>/ws` (loopback needs no auth). That subpath
is internal API — re-verify it after upgrading Paseo, and keep `@getpaseo/*`
pinned to the daemon's version.

## How it works

- The daemon-side watcher starts on the first `autopin.ensure` RPC, kicked
  from `addClientSide` whenever a Paseo client connects.
- Panel state sync: plugin RPC has no push channel in Paseo 0.7.2, so the
  command toggle, connect-time ensure, and the panel all publish into a
  module-scope client store (`src/state.client.ts`, consumed via
  `useSyncExternalStore`). A Command Center toggle therefore updates an open
  panel instantly; a slow 10s poll in the panel reconciles changes made from
  other clients.
- Command titles share the `Auto-Pin:` prefix deliberately: the Command
  Center ranks title matches by match tier + offset, so the shared prefix
  makes `auto`/`pin` queries tie between the two entries and fall back to
  registration order — Toggle registers first so it always lands on top.
- `react`/`react-native` are host-provided at runtime; they are
  devDependencies here only for typechecking.

## Development

```bash
npm install
npm run typecheck
paseo plugin install /path/to/paseo-auto-pin   # install from local checkout
paseo plugin reload auto-pin                   # pick up changes
paseo plugin logs auto-pin                     # watch the watcher
```

Layout follows the Paseo plugin convention: `*.server.ts` runs in the daemon,
`*.client.tsx` in the app, `*.shared.ts` in both.

| File | Role |
| --- | --- |
| `index.ts` | Plugin entry: registers RPCs, surface, sidebar item, commands |
| `src/contracts.shared.ts` | RPC contracts (`autopin.ensure`, `autopin.toggle`) |
| `src/handlers.server.ts` | RPC handlers |
| `src/watcher.server.ts` | Workspace stream watcher + pinning |
| `src/store.server.ts` | Persisted enabled/disabled state |
| `src/panel.client.tsx` | Sidebar surface (React Native) |
| `src/state.client.ts` | Module-scope client store bridging commands ↔ panel |

## License

[MIT](LICENSE)
