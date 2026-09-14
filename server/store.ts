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
    cached = { enabled: typeof raw?.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled };
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
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  cached = config;
}

let pending: Promise<unknown> = Promise.resolve();
export function toggleEnabled(): Promise<boolean> {
  const result = pending.then(async () => {
    const enabled = !(await isEnabled());
    await setEnabled(enabled);
    return enabled;
  });
  pending = result.catch(() => undefined);
  return result;
}
