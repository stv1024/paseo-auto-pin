import type { PluginHandlerContext } from "@getpaseo/plugin";
import { isEnabled, setEnabled } from "./store.server";
import { ensureWatcher } from "./watcher.server";

export async function handleEnsure(
  _input: Record<string, never>,
  { paseo }: PluginHandlerContext,
): Promise<{ running: boolean; enabled: boolean }> {
  const running = await ensureWatcher(paseo);
  return { running, enabled: await isEnabled() };
}

export async function handleToggle(
  _input: Record<string, never>,
  { paseo }: PluginHandlerContext,
): Promise<{ enabled: boolean }> {
  await ensureWatcher(paseo);
  const enabled = !(await isEnabled());
  await setEnabled(enabled);
  console.log(`[auto-pin] auto-pin ${enabled ? "enabled" : "disabled"}`);
  return { enabled };
}
