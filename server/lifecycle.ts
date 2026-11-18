import type { PluginServerContext, PluginSettings } from "@getpaseo/plugin/server";
import { MISSING_REVISION, shouldPin, type AutopinValues, type autopinSettings } from "../shared/settings";
import { readLegacy } from "./legacy";

export type AutopinSettings = PluginSettings<(typeof autopinSettings)["schema"]>;

/**
 * The saved values. Until a client copies the 0.6 file into the settings
 * document, the old file still decides, so an upgrade keeps the user's rules.
 * Returns null when the stored document is invalid.
 */
export async function currentValues(settings: AutopinSettings): Promise<AutopinValues | null> {
  const state = await settings.read();
  if (state.status !== "ready") {
    console.error(`[auto-pin] settings are invalid: ${state.error}`);
    return null;
  }
  if (state.revision === MISSING_REVISION) return (await readLegacy()) ?? state.values;
  return state.values;
}

export function registerAutoPin(server: PluginServerContext, settings: AutopinSettings): () => void {
  return server.addHook("workspace.create.after", async ({ workspace }, { paseo, signal }) => {
    if (signal.aborted || workspace.archivedAt) return;
    const values = await currentValues(settings);
    if (!values || signal.aborted || !shouldPin(values, workspace.projectId)) return;
    try {
      await paseo.workspaces.ref(workspace.id).setPinned(true);
      console.log(`[auto-pin] pinned new workspace ${workspace.id}`);
    } catch (error) {
      if (signal.aborted) return;
      console.error(`[auto-pin] failed to pin ${workspace.id}:`, error);
      throw error;
    }
  });
}
