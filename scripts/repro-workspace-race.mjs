import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Diagnostic only: prove the wire ordering on a released daemon (first seen on
// 0.9.2) with controlled response timing. The companion host regression tests the merge.
// The daemon still sends this order in 0.13.0; the 0.13.0 app no longer applies the old response.
// --ui keeps the daemon and its web app running, so the app itself creates workspaces and
// receives the held responses. With --ui, --no-hold lets the responses return at once.
const runtimeIndex = process.argv.indexOf("--runtime");
if (runtimeIndex < 0 || !process.argv[runtimeIndex + 1]) {
  throw new Error("Usage: node scripts/repro-workspace-race.mjs --runtime <Paseo runtime directory> [--ui [--no-hold]]");
}
const ui = process.argv.includes("--ui");
const hold = !ui || !process.argv.includes("--no-hold");
const requireRuntime = createRequire(join(resolve(process.argv[runtimeIndex + 1]), "package.json"));
const paseoVersion = requireRuntime("@getpaseo/cli/package.json").version;
const load = (name) => import(pathToFileURL(requireRuntime.resolve(name)).href);
const [{ createPaseoDaemon, loadConfig }, { DaemonClient }, { default: pino }, { Session }] = await Promise.all([
  load("@getpaseo/server"), load("@getpaseo/client/internal/daemon-client"), load("pino"),
  import(pathToFileURL(join(dirname(requireRuntime.resolve("@getpaseo/server")), "session.js")).href),
]);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = await mkdtemp(join(tmpdir(), "paseo-workspace-race-"));
const home = join(root, "home");
const directory = join(root, "workspace");
await mkdir(home);
await mkdir(directory);
process.env.PASEO_HOME = home;
const persisted = {
  daemon: { listen: "127.0.0.1:0", relay: { enabled: false }, mcp: { enabled: false } },
  agents: { providers: Object.fromEntries(["claude", "codex", "copilot", "opencode", "pi", "omp"].map((id) => [id, { enabled: false }])) },
  pluginsEnabled: true,
};
await writeFile(join(home, "config.json"), JSON.stringify(persisted));
const config = loadConfig(home, { env: {} });
const disabledSpeech = { provider: "local", explicit: true, enabled: false };
Object.assign(config, {
  daemonVersion: paseoVersion, browserToolsEnabled: false,
  webUi: { enabled: ui, distDir: ui ? resolve(dirname(requireRuntime.resolve("@getpaseo/server")), "../web-ui") : null },
  // The development-only mock provider lets the app start an initial agent with no real provider.
  isDev: ui,
  speech: { providers: Object.fromEntries(["dictationStt", "voiceTurnDetection", "voiceStt", "voiceTts"].map((id) => [id, disabledSpeech])) },
});
const logger = pino({ level: "warn" }, pino.destination(join(root, "daemon.log")));
let daemon;
let client;
let lastLivePinnedAt;
let seenPinned = false;
const pinnedIds = new Set();
const transitions = [];
const started = Date.now();

function record(source, workspace) {
  transitions.push({ ms: Date.now() - started, source, pinnedAt: workspace.pinnedAt });
}

function log(message) {
  console.log(`${Date.now() - started} ms ${message}`);
}

async function waitFor(condition) {
  const deadline = Date.now() + 10_000;
  while (!condition() && Date.now() < deadline) await delay(20);
  return condition();
}

const original = Session.prototype.createRequestedWorkspace;
// Delay only the return of the real descriptor, in this test process. This
// makes the race deterministic without altering payloads or stored pin data.
Session.prototype.createRequestedWorkspace = async function (...args) {
  const descriptor = await original.apply(this, args);
  if (ui && hold) {
    const pinned = await waitFor(() => pinnedIds.has(descriptor.id));
    log(`creation returns ${descriptor.id} ${pinned ? "after its pin" : "with no pin after 10 s"}`);
  } else if (!ui && descriptor.workspaceDirectory === directory) {
    assert.ok(await waitFor(() => seenPinned), "plugin must publish a pin before creation returns");
  }
  return descriptor;
};

async function reproduce() {
  const created = await client.createWorkspace({ source: { kind: "directory", path: directory }, title: "pin-race" });
  assert.ok(created.workspace, JSON.stringify(created));
  const livePinnedAtBeforeResponse = lastLivePinnedAt;
  record("workspace.create.response", created.workspace);
  const refreshed = (await client.fetchWorkspaces()).entries.find((entry) => entry.id === created.workspace.id);
  assert.ok(refreshed, "created workspace must remain in the daemon directory");
  record("fetch_workspaces", refreshed);
  console.log(JSON.stringify({
    transitions, livePinnedAtBeforeResponse,
    responsePinnedAt: created.workspace.pinnedAt, refreshedPinnedAt: refreshed.pinnedAt,
  }, null, 2));
  assert.ok(livePinnedAtBeforeResponse, "live update is pinned before the response");
  assert.equal(created.workspace.pinnedAt, null, "creation response contains the old descriptor");
  assert.equal(refreshed.pinnedAt, livePinnedAtBeforeResponse, "the daemon retains the same pin");
  console.log("REPRODUCED: pinned live update -> stale creation response -> pinned directory read");
  console.log("This is the wire order only. Paseo 0.13.0 and later apps keep the pin; use --ui to check an app.");
}

async function serveUi() {
  // The app creates workspaces in this Git project, as local checkouts or worktrees.
  const project = join(root, "project");
  await exec("git", ["init", "-b", "main", project]);
  await exec("git", ["-c", "user.name=Auto-Pin Test", "-c", "user.email=auto-pin@example.invalid",
    "-C", project, "commit", "--allow-empty", "-m", "Initial test commit"]);
  await client.createWorkspace({ source: { kind: "directory", path: project }, title: "race-project" });
  console.log(`Test web app: http://${persisted.daemon.listen}`);
  console.log(`Creation responses ${hold ? "wait for the pin" : "return at once"}. Press Enter to stop.`);
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));
  process.stdin.pause();
}

console.log(`Paseo ${paseoVersion}; artifacts: ${root}`);
try {
  daemon = await createPaseoDaemon(config, logger);
  await daemon.start();
  const target = daemon.getListenTarget();
  assert.equal(target?.type, "tcp");
  persisted.daemon.listen = `127.0.0.1:${target.port}`;
  await writeFile(join(home, "config.json"), JSON.stringify(persisted));
  client = new DaemonClient({
    url: `ws://${persisted.daemon.listen}/ws`, clientId: "workspace-race-repro",
    clientType: "cli", reconnect: { enabled: false },
  });
  await client.connect();
  await client.installDirectoryPlugin(pluginRoot);
  client.on("workspace_update", ({ payload }) => {
    if (payload.kind !== "upsert") return;
    const { id, pinnedAt } = payload.workspace;
    if (ui && Boolean(pinnedAt) !== pinnedIds.has(id)) log(`${pinnedAt ? "pinned" : "unpinned"} ${id}`);
    if (pinnedAt) pinnedIds.add(id);
    else pinnedIds.delete(id);
    if (payload.workspace.workspaceDirectory !== directory) return;
    lastLivePinnedAt = pinnedAt;
    if (lastLivePinnedAt) seenPinned = true;
    record("workspace_update", payload.workspace);
  });
  await client.fetchWorkspaces({ subscribe: {} });
  await (ui ? serveUi() : reproduce());
} finally {
  Session.prototype.createRequestedWorkspace = original;
  await client?.close();
  await daemon?.stop();
  logger.flush();
}
