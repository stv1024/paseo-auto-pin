import type { PluginServerContext } from "@getpaseo/plugin/server";
import { autopinEnsure, autopinProjects, autopinSetProjectRule, autopinToggle } from "./shared/contracts";
import { handleEnsure, handleProjects, handleSetProjectRule, handleToggle } from "./server/handlers";
import { registerAutoPin } from "./server/lifecycle";

export default function contribute(server: PluginServerContext) {
  server.handle(autopinEnsure, handleEnsure);
  server.handle(autopinToggle, handleToggle);
  server.handle(autopinProjects, handleProjects);
  server.handle(autopinSetProjectRule, handleSetProjectRule);
  return registerAutoPin(server);
}
