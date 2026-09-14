import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { PASEO_HOME } from "./store";

const CONFIG_FILE = join(PASEO_HOME, "config.json");

/** The injected PaseoApi exposes no pin mutation, so pinning goes through a
 * short-lived DaemonClient of our own against the local daemon's /ws endpoint. */
export async function pinWorkspace(workspaceId: string): Promise<void> {
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
