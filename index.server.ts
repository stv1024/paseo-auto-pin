import type { PluginServerContext } from "@getpaseo/plugin/server";
import { autopinEnsure, autopinToggle } from "./shared/contracts";
import { handleEnsure, handleToggle } from "./server/handlers";
import { registerAutoPin } from "./server/lifecycle";

export default function contribute(server: PluginServerContext) {
  server.handle(autopinEnsure, handleEnsure);
  server.handle(autopinToggle, handleToggle);
  return registerAutoPin(server);
}
