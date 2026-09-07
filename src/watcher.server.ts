import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PaseoApi, PaseoWorkspaceUpdate } from "@getpaseo/client";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { isEnabled, PASEO_HOME } from "./store.server";

const WORKSPACES_FILE = join(PASEO_HOME, "projects", "workspaces.json");
const CONFIG_FILE = join(PASEO_HOME, "config.json");

/** How far before watcher start a createdAt may lie and still count as "new".
 * Absorbs clock skew between the daemon writing the record and this process. */
const CREATED_AT_SLACK_MS = 60_000;

const seen = new Set<string>();
let startPromise: Promise<void> | null = null;
let watcherStartMs = 0;

/** Starts the workspace watcher once per subprocess lifetime. The injected
 * `paseo` session lives as long as the subprocess, so the subscription
 * persists across RPC calls. */
export async function ensureWatcher(paseo: PaseoApi): Promise<boolean> {
  startPromise ??= (async () => {
    watcherStartMs = Date.now();
    paseo.workspaces.subscribe((update: PaseoWorkspaceUpdate) => {
      if (update.kind === "upsert") void handleUpsert(update.workspace);
    });
    let cursor: string | undefined;
    do {
      const page = await paseo.workspaces.list({ subscribe: {}, page: { limit: 200, cursor } });
      for (const entry of page.entries) seen.add(entry.id);
      cursor = page.pageInfo?.hasMore ? page.pageInfo.nextCursor ?? undefined : undefined;
    } while (cursor);
    console.log(`[auto-pin] watcher started; ${seen.size} existing workspaces on record`);
  })();
  await startPromise;
  return true;
}

type UpsertWorkspace = Extract<PaseoWorkspaceUpdate, { kind: "upsert" }>["workspace"];

async function handleUpsert(workspace: UpsertWorkspace): Promise<void> {
  if (seen.has(workspace.id)) return;
  seen.add(workspace.id);
  try {
    if (!(await isEnabled())) return;
    if (workspace.pinnedAt || workspace.archivingAt) return;
    if (!(await isNewlyCreated(workspace.id))) {
      console.log(`[auto-pin] skipping ${workspace.id}: not newly created (likely unarchived)`);
      return;
    }
    await pinWorkspace(workspace.id);
    console.log(`[auto-pin] pinned new workspace ${workspace.id} (${workspace.name})`);
  } catch (error) {
    console.error(`[auto-pin] failed to pin ${workspace.id}:`, error);
  }
}

/** The wire descriptor carries no createdAt, so consult the daemon's own
 * workspace store. A record that is missing (not flushed yet) or created after
 * watcher start is a genuinely new workspace; an old createdAt means an
 * existing one resurfacing (e.g. unarchived) and must not be pinned. */
async function isNewlyCreated(workspaceId: string): Promise<boolean> {
  let records: Array<{ workspaceId?: string; createdAt?: string }>;
  try {
    records = JSON.parse(await readFile(WORKSPACES_FILE, "utf8"));
  } catch {
    return true;
  }
  const record = records.find((entry) => entry.workspaceId === workspaceId);
  if (!record?.createdAt) return true;
  return Date.parse(record.createdAt) >= watcherStartMs - CREATED_AT_SLACK_MS;
}

/** The injected PaseoApi exposes no pin mutation, so pinning goes through a
 * short-lived DaemonClient of our own against the local daemon's /ws endpoint. */
async function pinWorkspace(workspaceId: string): Promise<void> {
  const client = new DaemonClient({
    url: await daemonWsUrl(),
    clientId: `plugin-auto-pin-${process.pid}`,
    clientType: "cli",
    reconnect: { enabled: false },
  });
  try {
    await client.connect();
    await client.setWorkspacePinned(workspaceId, true);
  } finally {
    await client.close();
  }
}

async function daemonWsUrl(): Promise<string> {
  let listen = "127.0.0.1:6767";
  try {
    const config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
    if (typeof config?.daemon?.listen === "string") listen = config.daemon.listen;
  } catch {
    // fall through to the default
  }
  // A wildcard bind address is not dialable; loopback reaches the same daemon.
  listen = listen.replace(/^0\.0\.0\.0(?=:)/, "127.0.0.1");
  return `ws://${listen}/ws`;
}
