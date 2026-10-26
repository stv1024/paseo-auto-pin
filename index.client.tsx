import type { PluginClientContext } from "@getpaseo/plugin/client";
import { autopinEnsure, autopinSetProjectRule, autopinToggle, type ProjectRule } from "./shared/contracts";
import { messages } from "./client/messages";
import { AutoPinPanel } from "./client/panel";
import { AutoPinSidebarItem, SCREEN_ID } from "./client/sidebar";
import { publishAutopinState } from "./client/state";

// Set the current workspace's project rule without opening the panel.
const PROJECT_COMMANDS: { rule: ProjectRule; keywords: string[] }[] = [
  { rule: "always", keywords: ["always", "rule", "project"] },
  { rule: "never", keywords: ["never", "skip", "rule", "project"] },
  { rule: "default", keywords: ["default", "reset", "rule", "project"] },
];

export default function contribute(plugin: PluginClientContext) {
  // The screen keeps the former surface id so saved links still open it.
  // "Auto-Pin" is the product name, so these two titles stay untranslated.
  plugin.addScreen({ id: SCREEN_ID, title: "Auto-Pin", Component: AutoPinPanel });
  plugin.addSidebarHeaderItem({ id: "autopin", title: "Auto-Pin", Component: AutoPinSidebarItem });
  plugin.addCommandCenterItem({
    id: "toggle-autopin",
    // Every command title starts with "Auto-Pin" in every language on purpose:
    // the host ranks palette matches by tier + offset within the title, so a
    // shared prefix makes "auto"/"pin" queries tie and fall back to registration
    // order — this toggle registers first and therefore always ranks first.
    // Keywords stay in English, so English queries work in any app language.
    title: messages.message("commands.toggleDefault"),
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
    title: messages.message("commands.openPanel"),
    icon: "Pin",
    keywords: ["pin", "autopin", "workspace", "auto", "panel", "settings", "status"],
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: SCREEN_ID });
    },
  });
  for (const { rule, keywords } of PROJECT_COMMANDS) {
    plugin.addCommandCenterItem({
      id: `project-${rule}`,
      title: messages.message(`commands.${rule}`),
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
