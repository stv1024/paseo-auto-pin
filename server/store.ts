import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectRule, ProjectRules } from "../shared/contracts";

export const PASEO_HOME = process.env.PASEO_HOME ?? join(homedir(), ".paseo");
const DATA_DIR = join(PASEO_HOME, "plugin-data");
const CONFIG_PATH = join(DATA_DIR, "auto-pin.json");

type PluginConfig = {
  enabled: boolean;
  projectRules: ProjectRules;
  revision: number;
};

let cached: PluginConfig | null = null;
let loading: Promise<PluginConfig> | null = null;
let pending: Promise<unknown> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function load(): Promise<PluginConfig> {
  if (cached) return cached;
  // Share the first read so a late disk read cannot overwrite a saved setting.
  if (!loading) loading = (async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
    } catch (error) {
      if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const data = isRecord(raw) ? raw : {};
    const rules = isRecord(data.projectRules) ? data.projectRules : {};
    cached = {
      enabled: typeof data.enabled === "boolean" ? data.enabled : true,
      projectRules: Object.fromEntries(Object.entries(rules).filter(
        (entry): entry is [string, "always" | "never"] =>
          entry[0].length > 0 && (entry[1] === "always" || entry[1] === "never"),
      )),
      revision: typeof data.revision === "number" && Number.isSafeInteger(data.revision) && data.revision >= 0
        ? data.revision : 0,
    };
    return cached;
  })().finally(() => { loading = null; });
  return loading;
}

function snapshot(config: PluginConfig): PluginConfig {
  return { ...config, projectRules: { ...config.projectRules } };
}

export async function getConfig(): Promise<PluginConfig> {
  await pending;
  return snapshot(await load());
}

export async function shouldPinProject(projectId: string): Promise<boolean> {
  const config = await getConfig();
  const rule = Object.hasOwn(config.projectRules, projectId) ? config.projectRules[projectId] : "default";
  return rule === "always" || (rule === "default" && config.enabled);
}

function update(change: (config: PluginConfig) => void): Promise<PluginConfig> {
  const result = pending.then(async () => {
    const config = snapshot(await load());
    change(config);
    config.revision += 1;
    await mkdir(DATA_DIR, { recursive: true });
    const temporary = join(DATA_DIR, `auto-pin.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, "utf8");
      await rename(temporary, CONFIG_PATH);
    } finally {
      await rm(temporary, { force: true });
    }
    cached = config;
    return snapshot(config);
  });
  // Failed saves leave the cached setting intact and do not poison the queue.
  pending = result.catch(() => undefined);
  return result;
}

export async function toggleEnabled(): Promise<PluginConfig> {
  return update((config) => { config.enabled = !config.enabled; });
}

export async function setProjectRule(projectId: string, rule: ProjectRule): Promise<PluginConfig> {
  return update((config) => {
    if (rule === "default") delete config.projectRules[projectId];
    else config.projectRules = { ...config.projectRules, [projectId]: rule };
  });
}
