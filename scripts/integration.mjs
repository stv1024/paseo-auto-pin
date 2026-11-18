import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Install the Paseo CLI version to test in a separate directory, then pass --runtime DIR.
// All daemon data and test workspaces belong to a fresh temporary directory.
const runtimeIndex = process.argv.indexOf("--runtime");
if (runtimeIndex < 0 || !process.argv[runtimeIndex + 1]) {
  throw new Error("Usage: npm run test:integration -- --runtime <directory containing node_modules/@getpaseo/cli>");
}
const requireRuntime = createRequire(join(resolve(process.argv[runtimeIndex + 1]), "package.json"));
const paseoVersion = requireRuntime("@getpaseo/cli/package.json").version;
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
const directoryIndex = process.argv.indexOf("--plugin-directory");
if (directoryIndex >= 0 && !process.argv[directoryIndex + 1]) {
  throw new Error("--plugin-directory requires an installed plugin directory");
}
assert.ok(!(source && directoryIndex >= 0), "Use --source or --plugin-directory, not both");
const pluginDirectory = directoryIndex >= 0 ? resolve(process.argv[directoryIndex + 1]) : pluginRoot;
const keepUi = process.argv.includes("--ui");
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
// Auto-Pin 0.6 saved its values here. The upgrade must keep them.
const legacyFile = join(home, "plugin-data", "auto-pin.json");
await writeFile(legacyFile, '{"enabled":false,"revision":3}');
const config = loadConfig(home, { env: {} });
const disabledSpeech = { provider: "local", explicit: true, enabled: false };
Object.assign(config, {
  daemonVersion: paseoVersion,
  browserToolsEnabled: false,
  webUi: {
    enabled: keepUi,
    distDir: keepUi ? resolve(dirname(requireRuntime.resolve("@getpaseo/server")), "../web-ui") : null,
  },
  speech: { providers: Object.fromEntries(["dictationStt", "voiceTurnDetection", "voiceStt", "voiceTts"].map((id) => [id, disabledSpeech])) },
});
const log = pino({ level: "warn" }, pino.destination(join(testRoot, "daemon.log")));
let daemon;
let client;
console.log(`Integration artifacts: ${testRoot}`);

const rpc = (name, input = {}) => client.invokePluginRpc("auto-pin", name, input);
async function state() {
  const result = await rpc("settings.autopin.read");
  assert.equal(result.status, "ready", JSON.stringify(result));
  return result;
}
/** What a client does: read, change, and write against the read revision. Retries a conflict. */
async function update(change) {
  for (;;) {
    const current = await state();
    const result = await rpc("settings.autopin.write", { revision: current.revision, values: change(current.values) });
    if (result.status === "saved") return result.values;
    assert.equal(result.status, "conflict", JSON.stringify(result));
  }
}
const toggle = () => update((values) => ({ ...values, enabled: !values.enabled }));
async function workspace(id) {
  const result = await client.fetchWorkspaces();
  const entry = result.entries.find((item) => item.id === id);
  assert.ok(entry, `workspace ${id} must be present`);
  return entry;
}
async function createWorkspace(name, git = false) {
  const directory = join(testRoot, name);
  await mkdir(directory);
  if (git) {
    await exec("git", ["init", "-b", "main", directory]);
    await exec("git", ["-c", "user.name=Auto-Pin Test", "-c", "user.email=auto-pin@example.invalid",
      "-C", directory, "commit", "--allow-empty", "-m", "Initial test commit"]);
  }
  const result = await client.createWorkspace({ source: { kind: "directory", path: directory }, title: name });
  assert.ok(result.workspace, JSON.stringify(result));
  return result.workspace.id;
}
async function createWorktree(projectId, name) {
  const result = await client.createWorkspace({
    source: { kind: "worktree", projectId, branchName: name, baseBranch: "main" }, title: name,
  });
  assert.ok(result.workspace, JSON.stringify(result));
  return result.workspace.id;
}
function setRule(projectId, rule) {
  return update((values) => {
    const projectRules = { ...values.projectRules };
    if (rule === "default") delete projectRules[projectId];
    else projectRules[projectId] = rule;
    return { ...values, projectRules };
  });
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
  if (keepUi) console.log(`Test web app: http://${persisted.daemon.listen}`);
  client = new DaemonClient({ url: `ws://${persisted.daemon.listen}/ws`, clientId: "auto-pin-integration", clientType: "cli", reconnect: { enabled: false } });
  await client.connect();

  const existing = await createWorkspace("existing-before-install");
  if (source) await client.installPluginSource({ source });
  else await client.installDirectoryPlugin(pluginDirectory);
  const catalog = await client.getPluginCatalog();
  assert.ok(catalog.find((item) => item.id === "auto-pin")?.clientBundle, "client bundle must be available");
  const fresh = await state();
  assert.equal(fresh.revision, "missing");
  await assertUnpinned(await createWorkspace("disabled-switch"));
  console.log(`PASS: plugin loads on Paseo ${paseoVersion}; the 0.6 file decides until it is imported`);

  // The client entry imports the 0.6 file into the settings document once.
  const legacy = await rpc("autopin.legacy");
  assert.deepEqual(legacy, { values: { enabled: false, projectRules: {} } });
  assert.equal((await rpc("settings.autopin.write", { revision: "missing", values: legacy.values })).status, "saved");
  assert.equal((await rpc("settings.autopin.write", { revision: "missing", values: { enabled: true } })).status, "conflict");
  assert.deepEqual(await rpc("autopin.legacy"), { values: null });
  await delay(300);
  await assert.rejects(() => readFile(legacyFile));
  assert.deepEqual((await state()).values, { enabled: false, projectRules: {} });
  console.log("PASS: the 0.6 settings are imported once, and the old file is removed");

  assert.equal((await toggle()).enabled, true);
  const pinned = await createWorkspace("enabled-switch");
  await assertPinned(pinned);
  await assertUnpinned(existing);
  console.log("PASS: new workspaces follow the switch; existing workspaces stay unpinned");

  await client.setWorkspacePinned(pinned, false);
  await client.archiveWorkspace(pinned);
  await client.restoreWorkspace(pinned);
  await assertUnpinned(pinned);
  console.log("PASS: restoring an archived workspace does not repin it");

  const work = await createWorkspace("Everyday", true);
  const experiments = await createWorkspace("Experiments", true);
  await assertPinned(work);
  await assertPinned(experiments);
  const workProject = (await workspace(work)).projectId;
  const experimentsProject = (await workspace(experiments)).projectId;

  await setRule(experimentsProject, "never");
  await assertUnpinned(await createWorktree(experimentsProject, "never-with-default-on"));
  await assertPinned(experiments);
  await toggle();
  await setRule(workProject, "always");
  await assertPinned(await createWorktree(workProject, "always-with-default-off"));
  await assertUnpinned(await createWorktree(experimentsProject, "never-with-default-off"));
  await setRule(workProject, "default");
  await assertUnpinned(await createWorktree(workProject, "follow-default-off"));
  await toggle();
  await assertPinned(await createWorktree(workProject, "follow-default-on"));
  console.log("PASS: project rules override the default for new worktrees; saved pins stay unchanged");

  const beforeInvalid = await state();
  const invalid = await rpc("settings.autopin.write", {
    revision: beforeInvalid.revision,
    values: { ...beforeInvalid.values, projectRules: { [workProject]: "invalid" } },
  });
  assert.equal(invalid.status, "invalid");
  assert.deepEqual(await state(), beforeInvalid);
  console.log("PASS: invalid rules are rejected without changing settings");

  const toggles = await Promise.all([toggle(), toggle()]);
  assert.deepEqual(toggles.map((item) => item.enabled).sort(), [false, true]);
  assert.equal((await state()).values.enabled, true);
  await Promise.all([setRule(workProject, "always"), setRule(experimentsProject, "never")]);
  const beforeReload = await state();
  await client.reloadPlugin("auto-pin");
  assert.deepEqual(await state(), beforeReload);
  await assertUnpinned(pinned);
  await assertPinned(await createWorkspace("after-plugin-reload"));
  await assertPinned(await createWorktree(workProject, "always-after-reload"));
  await assertUnpinned(await createWorktree(experimentsProject, "never-after-reload"));
  const stored = JSON.parse(await readFile(join(home, "plugin-settings", "auto-pin", "autopin.json"), "utf8"));
  assert.deepEqual(stored, { version: 1, values: beforeReload.values });
  console.log("PASS: concurrent saves serialize; reload preserves the default and project rules");
  console.log(`Paseo ${paseoVersion} integration passed.`);
  if (keepUi) {
    console.log(`Open http://${persisted.daemon.listen} to check the panel. Press Enter to stop.`);
    process.stdin.resume();
    await new Promise((resolve) => process.stdin.once("data", resolve));
    process.stdin.pause();
  }
} catch (error) {
  // Plugin output is held by the daemon; preserve it before shutdown on failure.
  if (client) {
    try {
      const logs = await client.getPluginLogs("auto-pin");
      const logPath = join(testRoot, "plugin-logs.json");
      await writeFile(logPath, JSON.stringify(logs, null, 2));
      console.error(`Plugin failure logs: ${logPath}`);
    } catch (logError) {
      console.error("Could not collect plugin failure logs:", logError);
    }
  }
  throw error;
} finally {
  try { await client?.close(); }
  finally {
    await daemon?.stop();
    log.flush();
  }
}
