import type { PluginClientContext } from "@getpaseo/plugin/client";
import { withRule, type ProjectRule } from "./shared/settings";
import { messages } from "./client/messages";
import { AutoPinPanel } from "./client/panel";
import { importLegacy, updateSettings } from "./client/settings";
import { AutoPinSidebarItem, SCREEN_ID } from "./client/sidebar";

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
    onSelect({ rpc }) {
      return updateSettings(rpc, (values) => ({ ...values, enabled: !values.enabled }));
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
      onSelect({ rpc, workspace }) {
        return updateSettings(rpc, (values) => withRule(values, workspace.projectId, rule));
      },
    });
  }
  importLegacy(plugin.rpc).catch((error: unknown) => console.warn("[auto-pin] cannot import the old settings:", error));
  return () => {};
}
