import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { PASEO_HOME } from "./store";

const CONFIG_FILE = join(PASEO_HOME, "config.json");

/** The injected PaseoApi exposes no pin mutation, so pinning goes through a
 * short-lived DaemonClient of our own against the local daemon's /ws endpoint. */
export async function pinWorkspace(workspaceId: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const url = await daemonWsUrl();
  signal.throwIfAborted();
  const client = new DaemonClient({
    url,
    clientId: `plugin-auto-pin-${process.pid}`,
    clientType: "cli",
    connectTimeoutMs: 5_000,
    reconnect: { enabled: false },
  });
  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    // In 0.9.1 close() does not settle an in-flight connect(). Race cancellation
    // explicitly so a canceled hook can finish even during the handshake.
    await Promise.race([
      (async () => {
        await client.connect();
        signal.throwIfAborted();
        await client.setWorkspacePinned(workspaceId, true);
      })(),
      aborted,
    ]);
  } finally {
    signal.removeEventListener("abort", onAbort);
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
