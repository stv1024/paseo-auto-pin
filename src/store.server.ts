import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const PASEO_HOME = process.env.PASEO_HOME ?? join(homedir(), ".paseo");

const DATA_DIR = join(PASEO_HOME, "plugin-data");
const CONFIG_PATH = join(DATA_DIR, "auto-pin.json");

type PluginConfig = {
  enabled: boolean;
};

const DEFAULTS: PluginConfig = { enabled: true };

let cached: PluginConfig | null = null;

async function load(): Promise<PluginConfig> {
  if (cached) return cached;
  try {
    const raw = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Partial<PluginConfig>;
    cached = { ...DEFAULTS, ...raw };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

export async function isEnabled(): Promise<boolean> {
  return (await load()).enabled;
}

export async function setEnabled(enabled: boolean): Promise<void> {
  const config = { ...(await load()), enabled };
  cached = config;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
