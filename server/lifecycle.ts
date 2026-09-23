import type { PluginServerContext } from "@getpaseo/plugin/server";
import { shouldPinProject } from "./store";
import { pinWorkspace } from "./pin";

let running = false;
export function isRunning(): boolean { return running; }

export function registerAutoPin(server: PluginServerContext) {
  const unsubscribe = server.on("workspace.created", async ({ workspace }, { signal }) => {
    if (signal.aborted || workspace.archivedAt || !(await shouldPinProject(workspace.projectId))) return;
    if (signal.aborted) return;
    try {
      await pinWorkspace(workspace.id, signal);
      if (signal.aborted) return;
      console.log(`[auto-pin] pinned new workspace ${workspace.id}`);
    } catch (error) {
      if (signal.aborted) return;
      console.error(`[auto-pin] failed to pin ${workspace.id}:`, error);
      throw error;
    }
  });
  running = true;
  console.log("[auto-pin] workspace.created hook registered");
  return () => { running = false; unsubscribe(); };
}
