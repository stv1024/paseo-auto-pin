import type { PluginServerContext } from "@getpaseo/plugin/server";
import { autopinLegacy, autopinSettings, MISSING_REVISION } from "./shared/settings";
import { readLegacy, removeLegacy } from "./server/legacy";
import { registerAutoPin } from "./server/lifecycle";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(autopinSettings);
  server.handle(autopinLegacy, async () => {
    const state = await settings.read();
    return { values: state.revision === MISSING_REVISION ? await readLegacy() : null };
  });
  // Once the settings document exists, the old file has no use.
  const unsubscribe = settings.subscribe(() => removeLegacy());
  void settings.read().then((state) => {
    if (state.revision !== MISSING_REVISION) return removeLegacy();
  });
  const removeHook = registerAutoPin(server, settings);
  return () => {
    removeHook();
    unsubscribe();
  };
}
