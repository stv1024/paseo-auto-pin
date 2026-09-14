import { isEnabled, toggleEnabled } from "./store";
import { isRunning } from "./lifecycle";

export async function handleEnsure() {
  return { running: isRunning(), enabled: await isEnabled() };
}

export async function handleToggle() {
  const enabled = await toggleEnabled();
  console.log(`[auto-pin] auto-pin ${enabled ? "enabled" : "disabled"}`);
  return { running: isRunning(), enabled };
}
