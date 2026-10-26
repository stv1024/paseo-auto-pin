# Known issue: new pins temporarily disappear on Paseo 0.9.2 to 0.12.x

Auto-Pin can expose a client state race in Paseo 0.9.2 to 0.12.x: a workspace appears pinned,
disappears from Pinned, and returns after a later directory update.
The daemon's saved pin is not removed.

**Fixed in Paseo 0.13.0.** To fix it, update Paseo to 0.13.0 or later. Auto-Pin
needs no update for this fix. On Paseo 0.11.x and 0.12.x the race remains.

## Status and user impact

Upstream report: [getpaseo/paseo#5447](https://github.com/getpaseo/paseo/issues/5447),
filed September 26, 2026 with the reproduction script, raw output, and candidate
patch. Filing the report does not imply that the fix has been accepted or released.

Confirmed with Auto-Pin **0.4.0** and Paseo **0.9.2** on Windows 11. Paseo 0.9.2
was still the latest stable release when checked on September 26, 2026.
No fixed official release has been verified. Other versions have not been
checked for this specific race; the plugin's supported range is not a claim
that every host version is free of this issue.

**Update, October 9, 2026:** the issue is still open (labeled p3). On September 26
the Paseo maintainers' bot reproduced it on `main` without added delays when the
workspace starts with an initial agent, confirmed the cause, and left the choice
of fix to the maintainer. Paseo 0.11.1 is the latest stable release and contains
no fix. Its plugin SDK still has no way to set a pin as part of the creation request.

**Update, October 24, 2026:** the race still reproduces on the released Paseo
**0.12.0** daemon with the diagnostic below. `acceptWorkspaces()` is unchanged in
v0.12.0, `main`, and v0.13.0-beta.2. The issue is open (p2). The 0.12.0 plugin
SDK changed only ACP code: `PaseoApi` still has no pin mutation, and
`workspace.create` still has no pin field. The stock plugin passes the
integration suite on 0.12.0.

Upstream fix proposal: [getpaseo/paseo#7758](https://github.com/getpaseo/paseo/pull/7758),
opened October 24, 2026 against `main`. It applies the guard described below and
adds four replica unit tests and a browser E2E test. The E2E test creates a
workspace with a prompt, pins it while the creation response is held, and counts
frames in which the row is missing from Pinned. On unchanged `main` it failed in
3 of 3 runs (32 to 34 missing frames); with the change it passed in 4 of 4 runs.
An open pull request is not a released fix.

**Update, October 26, 2026: fixed in Paseo 0.13.0.** Paseo merged #7758 on
October 24, 2026, which closed #5447, and released it the same day in
[Paseo 0.13.0](https://github.com/getpaseo/paseo/releases/tag/v0.13.0)
(merge commit `632a7f885958f318ee9e0619b3af075d4798bf55`; 0.13.0-beta.2 and
earlier do not contain it). In 0.13.0, `acceptWorkspaces()` only seeds rows that
are missing. The daemon still sends the old creation response after the live pin
update, but the app no longer applies it. Paseo **0.13.0** is the first verified
fixed version: the stock plugin passed the
[released-client check](#released-fix-paseo-0130) below.

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

The script accepts any installed Paseo version and prints it; replace `0.9.2`
to check another release. The wire ordering was last confirmed on 0.13.0, where
the app no longer applies the old response.

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

Add `--ui` to test the client merge in the app. The script then keeps the test
daemon and its bundled web app running, creates a Git project, and prints the
app URL. It also enables Paseo's development-only mock agent provider, so the
app can start a workspace with an initial message without a real provider.
Every workspace that the app creates returns only after its pin update arrives
(10-second limit). Add `--no-hold` as well to let creation responses return
without delay. The script prints each pin, unpin, and held response. Press
Enter to stop it.

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

### Released fix (Paseo 0.13.0)

Checked on October 26, 2026 on Windows 11 with the released Paseo 0.13.0
daemon and web app and the stock plugin (the code in Auto-Pin 0.5.1 and 0.5.2). The diagnostic
ran with `--ui`. A headless Chrome, driven by Playwright from outside this
repository, used the app's **New workspace** screen to create workspaces:

- with an initial message (mock agent) and empty;
- as a local checkout and as a new worktree.

For each workspace, the browser sampled every animation frame from **Create**
until 3 seconds after the workspace opened. It counted the frames in which the
new row was missing from Pinned after it first appeared there, as Paseo's own
E2E test does. It also recorded the workspace messages that the app received.

| Arrival order | Scenario | Paseo 0.13.0 | Paseo 0.12.0 (control) |
| --- | --- | --- | --- |
| Held: pin, then old response | Initial message, local | 0 frames (2 runs) | 171 frames; still missing at the end |
| Held: pin, then old response | Initial message, worktree | 0 frames (2 runs) | not run |
| Held: pin, then old response | Empty, local | 0 frames (3 runs) | 183 frames; still missing at the end |
| Held: pin, then old response | Empty, worktree | 0 frames (2 runs) | 34 frames; back after a later update |
| Not held: pin first | Initial message, local and worktree | 0 frames | not run |
| Not held: response first | Empty, local | 0 frames | not run |
| Not held: pin first | Empty, worktree | 0 frames | not run |

In every held run, the app received the creation response with
`pinnedAt: null` after the pinned update, so each run reproduced the race on
the wire. With an initial message, the pin also arrived first without the
hold, because the response waits for the agent to start. Every 0.13.0 row was
still in Pinned at the end.

Manual unpinning from the row menu also passed in both held runs. The row left
Pinned in the next frame and stayed listed and unpinned, and the daemon
recorded no new pin in the next 4 seconds.

This check did not cover real agent providers, the desktop and mobile apps,
reconnects, or archive and restore. The upstream E2E test and review covered
the replica change with an agent.

### Candidate patch (Paseo 0.9.2)

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

Paseo 0.13.0 is the first verified fixed version (see
[Released fix](#released-fix-paseo-0130)). Auto-Pin 0.6.0 and later require
Paseo 0.13.0, so they do not run on an affected host. Auto-Pin 0.5.2 remains the
release for Paseo 0.11.x and 0.12.x, where the race remains; tell users there to
update Paseo.
Keep the historical reproduction versioned: it shows the old wire ordering,
which is still sent in 0.13.0. If a later Paseo release changes the creation
flow or the workspace replica, run the `--ui` check again.

The existing integration compromises are documented in
[Paseo integration limits](development.md#paseo-integration-limits): a small
internal-client pin adapter and plugin-owned settings persistence, because the
Paseo plugin API (still in 0.13.0) does not expose those writes. They are
independent of this race.
