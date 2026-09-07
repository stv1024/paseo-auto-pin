import type { PluginContext } from "@getpaseo/plugin";
import { autopinEnsure, autopinToggle } from "./src/contracts.shared";
import { handleEnsure, handleToggle } from "./src/handlers.server";
import { AutoPinPanel } from "./src/panel.client";
import { publishAutopinState } from "./src/state.client";

export default function contribute(plugin: PluginContext) {
  plugin.handle(autopinEnsure, handleEnsure);
  plugin.handle(autopinToggle, handleToggle);
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
      publishAutopinState({ ...result, running: true });
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
  plugin.addClientSide((client) => {
    // Kick the daemon-side watcher as soon as any client connects, so new
    // workspaces are pinned even before the toggle command is ever used.
    void client
      .rpc(autopinEnsure, {})
      .then(publishAutopinState)
      .catch(() => undefined);
    return () => {};
  });
  return () => {};
}
