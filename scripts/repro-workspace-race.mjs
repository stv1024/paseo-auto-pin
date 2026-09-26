import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Diagnostic only: prove the wire ordering on the released 0.9.2 daemon with
// controlled response timing. The companion host regression tests the merge.
const runtimeIndex = process.argv.indexOf("--runtime");
if (runtimeIndex < 0 || !process.argv[runtimeIndex + 1]) {
  throw new Error("Usage: node scripts/repro-workspace-race.mjs --runtime <Paseo 0.9.2 runtime directory>");
}
const requireRuntime = createRequire(join(resolve(process.argv[runtimeIndex + 1]), "package.json"));
assert.equal(requireRuntime("@getpaseo/cli/package.json").version, "0.9.2");
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
  daemonVersion: "0.9.2", browserToolsEnabled: false,
  webUi: { enabled: false, distDir: null },
  speech: { providers: Object.fromEntries(["dictationStt", "voiceTurnDetection", "voiceStt", "voiceTts"].map((id) => [id, disabledSpeech])) },
});
const logger = pino({ level: "warn" }, pino.destination(join(root, "daemon.log")));
let daemon;
let client;
let lastLivePinnedAt;
let seenPinned = false;
const transitions = [];
const started = Date.now();

function record(source, workspace) {
  transitions.push({ ms: Date.now() - started, source, pinnedAt: workspace.pinnedAt });
}

const original = Session.prototype.createRequestedWorkspace;
// Delay only the return of the real descriptor, in this test process. This
// makes the race deterministic without altering payloads or stored pin data.
Session.prototype.createRequestedWorkspace = async function (...args) {
  const descriptor = await original.apply(this, args);
  if (descriptor.workspaceDirectory === directory) {
    const deadline = Date.now() + 10_000;
    while (!seenPinned && Date.now() < deadline) await delay(20);
    assert.ok(seenPinned, "plugin must publish a pin before creation returns");
  }
  return descriptor;
};

console.log(`Artifacts: ${root}`);
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
    if (payload.kind !== "upsert" || payload.workspace.workspaceDirectory !== directory) return;
    lastLivePinnedAt = payload.workspace.pinnedAt;
    if (lastLivePinnedAt) seenPinned = true;
    record("workspace_update", payload.workspace);
  });
  await client.fetchWorkspaces({ subscribe: {} });
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
} finally {
  Session.prototype.createRequestedWorkspace = original;
  await client?.close();
  await daemon?.stop();
  logger.flush();
}
