import type { PluginClientContext } from "@getpaseo/plugin/client";
import { autopinEnsure, autopinSetProjectRule, autopinToggle, type ProjectRule } from "./shared/contracts";
import { AutoPinPanel } from "./client/panel";
import { publishAutopinState } from "./client/state";

// Set the current workspace's project rule without opening the panel.
const PROJECT_COMMANDS: { rule: ProjectRule; title: string; keywords: string[] }[] = [
  { rule: "always", title: "Auto-Pin: Always Pin This Project", keywords: ["always", "rule", "project"] },
  { rule: "never", title: "Auto-Pin: Never Pin This Project", keywords: ["never", "skip", "rule", "project"] },
  { rule: "default", title: "Auto-Pin: This Project Follows Default", keywords: ["default", "reset", "rule", "project"] },
];

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
    title: "Auto-Pin: Toggle Default",
    icon: "Pin",
    keywords: ["pin", "autopin", "workspace", "auto", "toggle", "default", "enable", "disable"],
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
  for (const { rule, title, keywords } of PROJECT_COMMANDS) {
    plugin.addCommandCenterItem({
      id: `project-${rule}`,
      title,
      icon: "Pin",
      keywords: ["pin", "autopin", "workspace", "auto", ...keywords],
      context: "workspace",
      async onSelect({ rpc, workspace }) {
        publishAutopinState(await rpc(autopinSetProjectRule, { projectId: workspace.projectId, rule }));
      },
    });
  }
  let disposed = false;
  void plugin.rpc(autopinEnsure, {}).then((result) => {
    if (!disposed) publishAutopinState(result);
  }).catch(() => { /* The panel reports connection failures and retries. */ });
  return () => { disposed = true; };
}
