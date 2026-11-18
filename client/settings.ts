import { settingsRpc } from "@getpaseo/plugin";
import type { PluginCommandCapabilities } from "@getpaseo/plugin/client";
import { autopinLegacy, autopinSettings, MISSING_REVISION, valuesSchema, type AutopinValues } from "../shared/settings";

type Rpc = PluginCommandCapabilities["rpc"];
const rpc = settingsRpc(autopinSettings.id);

/**
 * Saves a change from code that cannot use `useSettings`, such as a Command
 * Center item. Reads the current document first, and reads again once when
 * another client saved in between.
 */
export async function updateSettings(call: Rpc, change: (values: AutopinValues) => AutopinValues): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await call(rpc.read, {});
    if (current.status !== "ready") throw new Error(current.error);
    const result = await call(rpc.write, {
      revision: current.revision,
      values: change(valuesSchema.parse(current.values)),
    });
    if (result.status === "saved") return;
    if (result.status === "invalid") throw new Error(result.error);
  }
  throw new Error("Settings changed on another client. Try again.");
}

/**
 * Copies the values of Auto-Pin 0.6 and earlier into the settings document,
 * once. A document that already exists is never overwritten.
 */
export async function importLegacy(call: Rpc): Promise<void> {
  const current = await call(rpc.read, {});
  if (current.revision !== MISSING_REVISION) return;
  const { values } = await call(autopinLegacy, {});
  if (!values) return;
  // A conflict means another client imported first.
  await call(rpc.write, { revision: MISSING_REVISION, values });
}
