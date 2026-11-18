import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { valuesSchema, type AutopinValues } from "../shared/settings";

/** Where Auto-Pin 0.6 and earlier saved its values. */
export const LEGACY_PATH = join(process.env.PASEO_HOME ?? join(homedir(), ".paseo"), "plugin-data", "auto-pin.json");

/** The values from the old file, or null when there is no usable file. */
export async function readLegacy(path = LEGACY_PATH): Promise<AutopinValues | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const { enabled, projectRules } = raw as Record<string, unknown>;
  const rules = typeof projectRules === "object" && projectRules !== null ? projectRules : {};
  return valuesSchema.parse({
    enabled: typeof enabled === "boolean" ? enabled : true,
    projectRules: Object.fromEntries(Object.entries(rules).filter(
      ([id, rule]) => id.length > 0 && (rule === "always" || rule === "never"),
    )),
  });
}

/** Deletes the old file after its values are in the settings document. */
export async function removeLegacy(path = LEGACY_PATH): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch (error) {
    console.warn("[auto-pin] cannot remove the old settings file:", error);
  }
}
