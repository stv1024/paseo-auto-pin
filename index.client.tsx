import type { PluginClientContext } from "@getpaseo/plugin/client";
import { autopinEnsure, autopinToggle } from "./shared/contracts";
import { AutoPinPanel } from "./client/panel";
import { publishAutopinState } from "./client/state";

export default function contribute(plugin: PluginClientContext) {
  plugin.addSurface("autopin", AutoPinPanel);
  plugin.addSidebarItem({
    id: "autopin",
    title: "Auto-Pin",
    icon: "Pin",
    surface: "autopin",
  });
  plugin.addCommandCenterItem({
    id: "toggle-autopin",
    // Both command titles share the "Auto-Pin:" prefix on purpose: the host
    // ranks palette matches by tier + offset within the title, so a shared
    // prefix makes "auto"/"pin" queries tie and fall back to registration
    // order — this toggle registers first and therefore always ranks first.
    title: "Auto-Pin: Toggle",
    icon: "Pin",
    keywords: ["pin", "autopin", "workspace", "auto", "toggle", "enable", "disable"],
    context: "global",
    async onSelect({ rpc }) {
      const result = await rpc(autopinToggle, {});
      // Feed the shared client store so an open Auto-Pin panel reflects the
      // new state immediately instead of waiting for its reconcile poll.
      publishAutopinState(result);
    },
  });
  plugin.addCommandCenterItem({
    id: "open-autopin",
    title: "Auto-Pin: Open Panel",
    icon: "Pin",
    keywords: ["pin", "autopin", "workspace", "auto", "panel", "settings", "status"],
    context: "global",
    onSelect({ openSurface }) {
      openSurface("autopin");
    },
  });
  let disposed = false;
  void plugin.rpc(autopinEnsure, {}).then((result) => {
    if (!disposed) publishAutopinState(result);
  }).catch(() => {
    if (!disposed) publishAutopinState({ running: false });
  });
  return () => { disposed = true; };
}
