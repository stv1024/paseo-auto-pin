# Known issue: new pins temporarily disappear on Paseo 0.9.2

Auto-Pin can expose a client state race in Paseo 0.9.2: a workspace appears pinned,
disappears from Pinned, and returns after a later directory update.
The daemon's saved pin is not removed.

## Status and user impact

Upstream report: [getpaseo/paseo#5447](https://github.com/getpaseo/paseo/issues/5447),
filed September 26, 2026 with the reproduction script, raw output, and candidate
patch. Filing the report does not imply that the fix has been accepted or released.

Confirmed with Auto-Pin **0.4.0** and Paseo **0.9.2** on Windows 11. Paseo 0.9.2
was still the latest stable release when checked on September 26, 2026.
No fixed official release has been verified. Other versions have not been
checked for this specific race; the plugin's supported range is not a claim
that every host version is free of this issue.

The interval before the pin reappears depends on the next directory update or
resynchronization. Auto-Pin has no timer that removes or reapplies pins. Its
panel's **Refresh** button refreshes plugin settings and projects, not the host
sidebar. Updating or reloading the plugin does not fix this host issue.

Normal installation continues to use an official Paseo release. The candidate
patch below is investigation material for maintainers, not an installation
requirement or a supported custom Paseo distribution.

## Cause

Paseo captures a workspace descriptor during creation. While it finishes the
creation request, Auto-Pin handles `workspace.created` and pins the workspace.
The client receives that live update before the older creation response.
Both the response and creation progress callbacks feed their snapshots through
`HostRuntimeController.acceptWorkspaceSnapshots()`. The 0.9.2 workspace replica
overwrites its current row with each of these snapshots, including the old
`pinnedAt: null` value.

Relevant source at `v0.9.2`:

- [Creation response merge](https://github.com/getpaseo/paseo/blob/v0.9.2/packages/app/src/screens/new-workspace-screen.tsx#L848-L855)
- [Workspace replica snapshot acceptance](https://github.com/getpaseo/paseo/blob/v0.9.2/packages/app/src/runtime/directory-sync/workspace-replica.ts#L84-L86)

The same unconditional acceptance method was present in main at
`76a9781ba566ab511ed8ec9b08ebf53425229f39`. That was a source inspection; the
runtime reproduction and regression checks below target v0.9.2.

## Reproduction for maintainers

The reported desktop sequence is: enable Auto-Pin, create a workspace with an
initial message, then observe it appear in Pinned, disappear, and return after
a later workspace update. It is timing-dependent in normal use.

For a deterministic wire-level reproduction, install a separate runtime and run
the diagnostic from a checkout of this plugin with its dependencies installed:

```bash
npm install --prefix /path/to/paseo-test-runtime --no-save --ignore-scripts @getpaseo/cli@0.9.2
node scripts/repro-workspace-race.mjs --runtime /path/to/paseo-test-runtime
```

The script creates a temporary Paseo home and workspace, binds an automatically
assigned loopback port, and disables agent providers, relay, MCP, and speech.
It loads the real plugin, subscribes to workspace updates, and creates a
workspace. In this test process only, it holds the return of
`Session.createRequestedWorkspace()` until the real pin update arrives. It does
not change the descriptor or stored pin. The original method is restored and
the test daemon is stopped in `finally`; test files and logs remain in the
printed temporary directory. The ordinary Paseo home and daemon are not used.

Expected evidence is a non-null `livePinnedAtBeforeResponse`, a null
`responsePinnedAt`, and a matching non-null `refreshedPinnedAt`.
This script proves response ordering and retained server state. It does not
launch the UI or by itself test the client merge; the regression below exercises
Paseo's actual workspace replica and session store.

## Candidate upstream fix

[The source patch](https://github.com/stv1024/paseo-auto-pin/blob/main/patches/paseo-0.9.2-workspace-snapshots.patch) targets Paseo
tag `v0.9.2`, commit `c67b7158b441bb09026b38d86ae335cc4b49190a`.
It is retained in this repository for upstream review and is not applied by
plugin installation, update, or reload. Paseo source is licensed under Apache-2.0.

Creation snapshots seed missing workspace rows. Once a row exists, directory
updates and reconciliation own its state. The replica applies that rule before
publishing to the session store or returning mutations for the persistent cache.
It applies to the entire descriptor, so pins, titles, and other live fields do
not need separate exceptions. Live updates can still pin or unpin a workspace.

The public snapshot entry point is also used to restore an optimistically hidden
workspace after an archive failure. A missing row can still be restored; an
already received row keeps its current state.

For source-level evaluation only, apply it in a separate Paseo source checkout:

```bash
git checkout v0.9.2
git apply --check /path/to/paseo-auto-pin/patches/paseo-0.9.2-workspace-snapshots.patch
git apply /path/to/paseo-auto-pin/patches/paseo-0.9.2-workspace-snapshots.patch
```

The proposal needs upstream review before it should be treated as a released
fix. Its validation is scoped to the existing-row overwrite: removal/tombstone
races and reconnect behavior have not been verified with this candidate.

## Verification

The new late-creation-response regression failed on the original Paseo code and
passed after the change. All nine tests in `workspace-replica.test.ts` pass,
covering both arrival orders, mixed batches, manual unpinning, and archive
rollback. The app typecheck and lint for both changed files pass after building
the workspace dependencies and applying Paseo's normal postinstall patches.
The source patch passes forward and reverse applicability checks against the
v0.9.2 checkout. Auto-Pin's 36 tests and typecheck also pass.

To run the focused host tests from a prepared Paseo checkout:

```bash
npm run test --workspace=@getpaseo/app -- src/runtime/directory-sync/workspace-replica.test.ts --bail=1
npm run typecheck --workspace=@getpaseo/app
npm run lint -- packages/app/src/runtime/directory-sync/workspace-replica.ts packages/app/src/runtime/directory-sync/workspace-replica.test.ts
```

This verifies the source change. A packaged client build and UI smoke test have
not been performed, and the installed Paseo client has not been patched.

## Maintenance policy

Auto-Pin keeps its existing flow: one creation hook, one project-rule decision,
one pin request. Keep host synchronization fixes in Paseo. Do not add arbitrary
pin delays, periodic repinning, host monkey patches, or client-store writes to
the shipped plugin to mask this race; these cannot guarantee response ordering
and can interfere with manual pin changes. The diagnostic's timing injection
is isolated test code and is not loaded by either plugin entry point.

After an official fix is released, verify the released client with the stock
plugin: initial-message and empty-workspace creation, local checkouts and
worktrees, both update/response orders, and manual unpinning. Record the first
verified fixed version and the upstream issue or release link here, then revise
the README's known-issue notice. Keep the historical reproduction versioned;
it demonstrates the old wire ordering, which may remain valid even after the
client merge is fixed. Do not mark the plugin fixed merely because this source
patch or a proposed upstream change exists.

The existing integration compromises are documented in
[Paseo integration limits](development.md#paseo-integration-limits): a small
internal-client pin adapter and plugin-owned settings persistence, because the
Paseo 0.9.1 API does not expose those writes. They are independent of this race.
