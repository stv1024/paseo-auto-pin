import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { ProjectRule } from "../shared/contracts";
import { getConfig, setProjectRule, toggleEnabled } from "./store";
import { isRunning } from "./lifecycle";

export async function handleEnsure() {
  return { running: isRunning(), ...await getConfig() };
}

export async function handleToggle() {
  const config = await toggleEnabled();
  console.log(`[auto-pin] default ${config.enabled ? "on" : "off"}`);
  return { running: isRunning(), ...config };
}

export async function handleProjects(_input: object, { paseo }: PluginHandlerContext) {
  const { projects } = await paseo.projects.list();
  return {
    projects: projects.map((project) => ({
      id: project.projectId,
      name: project.projectDisplayName,
      path: project.projectRootPath,
    })).sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)),
  };
}

export async function handleSetProjectRule({ projectId, rule }: { projectId: string; rule: ProjectRule }) {
  return { running: isRunning(), ...await setProjectRule(projectId, rule) };
}
