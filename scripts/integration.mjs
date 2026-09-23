import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Install @getpaseo/cli@0.9.1 in a separate directory, then pass --runtime DIR.
// All daemon data and test workspaces belong to a fresh temporary directory.
const runtimeIndex = process.argv.indexOf("--runtime");
if (runtimeIndex < 0 || !process.argv[runtimeIndex + 1]) {
  throw new Error("Usage: npm run test:integration -- --runtime <directory containing node_modules/@getpaseo/cli>");
}
const requireRuntime = createRequire(join(resolve(process.argv[runtimeIndex + 1]), "package.json"));
assert.equal(requireRuntime("@getpaseo/cli/package.json").version, "0.9.1", "integration requires Paseo CLI 0.9.1");
const load = (name) => import(pathToFileURL(requireRuntime.resolve(name)).href);
const [{ createPaseoDaemon, loadConfig }, { DaemonClient }, { default: pino }] = await Promise.all([
  load("@getpaseo/server"), load("@getpaseo/client/internal/daemon-client"), load("pino"),
]);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceIndex = process.argv.indexOf("--source");
if (sourceIndex >= 0 && !process.argv[sourceIndex + 1]) {
  throw new Error("--source requires a Git or npm plugin source");
}
const source = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : undefined;
const testRoot = await mkdtemp(join(tmpdir(), "paseo-auto-pin-integration-"));
const home = join(testRoot, "home");
await mkdir(join(home, "plugin-data"), { recursive: true });
process.env.PASEO_HOME = home;
const providers = Object.fromEntries(["claude", "codex", "copilot", "opencode", "pi", "omp"].map((id) => [id, { enabled: false }]));
const persisted = {
  daemon: { listen: "127.0.0.1:0", relay: { enabled: false }, mcp: { enabled: false } },
  agents: { providers },
  pluginsEnabled: true,
};
await writeFile(join(home, "config.json"), JSON.stringify(persisted));
await writeFile(join(home, "plugin-data", "auto-pin.json"), '{"enabled":false}');
const config = loadConfig(home, { env: {} });
const disabledSpeech = { provider: "local", explicit: true, enabled: false };
Object.assign(config, {
  daemonVersion: "0.9.1",
  browserToolsEnabled: false,
  webUi: { enabled: false, distDir: null },
  speech: { providers: Object.fromEntries(["dictationStt", "voiceTurnDetection", "voiceStt", "voiceTts"].map((id) => [id, disabledSpeech])) },
});
const log = pino({ level: "warn" }, pino.destination(join(testRoot, "daemon.log")));
let daemon;
let client;
console.log(`Integration artifacts: ${testRoot}`);

async function state() {
  return client.invokePluginRpc("auto-pin", "autopin.ensure", {});
}
async function workspace(id) {
  const result = await client.fetchWorkspaces();
  const entry = result.entries.find((item) => item.id === id);
  assert.ok(entry, `workspace ${id} must be present`);
  return entry;
}
async function createWorkspace(name) {
  const directory = join(testRoot, name);
  await mkdir(directory);
  const result = await client.createWorkspace({ source: { kind: "directory", path: directory }, title: name });
  assert.ok(result.workspace, JSON.stringify(result));
  return result.workspace.id;
}
async function assertPinned(id) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await workspace(id)).pinnedAt) return;
    await delay(100);
  }
  assert.fail(`workspace ${id} was not pinned within 10 seconds`);
}
async function assertUnpinned(id) {
  await delay(300);
  assert.equal((await workspace(id)).pinnedAt, null);
}

try {
  daemon = await createPaseoDaemon(config, log);
  await daemon.start();
  const target = daemon.getListenTarget();
  assert.equal(target?.type, "tcp");
  // The plugin reads the actual bound port from its own isolated Paseo config.
  persisted.daemon.listen = `127.0.0.1:${target.port}`;
  await writeFile(join(home, "config.json"), JSON.stringify(persisted));
  client = new DaemonClient({ url: `ws://${persisted.daemon.listen}/ws`, clientId: "auto-pin-integration", clientType: "cli", reconnect: { enabled: false } });
  await client.connect();

  const existing = await createWorkspace("existing-before-install");
  if (source) await client.installPluginSource({ source });
  else await client.installDirectoryPlugin(pluginRoot);
  const catalog = await client.getPluginCatalog();
  assert.ok(catalog.find((item) => item.id === "auto-pin")?.clientBundle, "client bundle must be available");
  assert.deepEqual(await state(), { running: true, enabled: false });
  console.log("PASS: plugin loads on Paseo 0.9.1 and preserves disabled settings");

  await assertUnpinned(await createWorkspace("disabled-switch"));
  assert.deepEqual(await client.invokePluginRpc("auto-pin", "autopin.toggle", {}), { running: true, enabled: true });
  const pinned = await createWorkspace("enabled-switch");
  await assertPinned(pinned);
  await assertUnpinned(existing);
  console.log("PASS: new workspaces follow the switch; existing workspaces stay unpinned");

  await client.setWorkspacePinned(pinned, false);
  await client.archiveWorkspace(pinned);
  await client.restoreWorkspace(pinned);
  await assertUnpinned(pinned);
  console.log("PASS: restoring an archived workspace does not repin it");

  const toggles = await Promise.all([
    client.invokePluginRpc("auto-pin", "autopin.toggle", {}),
    client.invokePluginRpc("auto-pin", "autopin.toggle", {}),
  ]);
  assert.deepEqual(toggles.map((item) => item.enabled).sort(), [false, true]);
  assert.equal((await state()).enabled, true);
  await client.reloadPlugin("auto-pin");
  assert.deepEqual(await state(), { running: true, enabled: true });
  await assertUnpinned(pinned);
  await assertPinned(await createWorkspace("after-plugin-reload"));
  assert.deepEqual(JSON.parse(await readFile(join(home, "plugin-data", "auto-pin.json"), "utf8")), { enabled: true });
  console.log("PASS: concurrent toggles serialize; reload preserves settings and re-registers the hook");
  console.log("Paseo 0.9.1 integration passed.");
} finally {
  try { await client?.close(); }
  finally {
    await daemon?.stop();
    log.flush();
  }
}
