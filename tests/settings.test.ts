import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLegacy, removeLegacy } from "../server/legacy";
import { importLegacy, updateSettings } from "../client/settings";
import { autopinSettings, ruleFor, shouldPin, valuesSchema, withRule } from "../shared/settings";

describe("settings document", () => {
  it("parses an empty document into the defaults", () => {
    expect(valuesSchema.parse({})).toEqual({ enabled: true, projectRules: {} });
    expect(autopinSettings).toMatchObject({ id: "autopin", scope: "host", version: 1 });
  });

  it("sets and clears project rules without changing the input", () => {
    const values = { enabled: true, projectRules: { a: "never" as const } };
    const next = withRule(values, "b", "always");
    expect(next.projectRules).toEqual({ a: "never", b: "always" });
    expect(withRule(next, "a", "default").projectRules).toEqual({ b: "always" });
    expect(values.projectRules).toEqual({ a: "never" });
    expect(ruleFor(next, "c")).toBe("default");
    expect(ruleFor(next, "toString")).toBe("default");
    expect(shouldPin(next, "a")).toBe(false);
    expect(shouldPin({ ...next, enabled: false }, "b")).toBe(true);
  });
});

describe("0.6 settings file", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "auto-pin-")); });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("reads the default and the valid project rules", async () => {
    const file = join(dir, "auto-pin.json");
    await writeFile(file, JSON.stringify({
      enabled: false, revision: 12, projectRules: { a: "always", b: "never", c: "sometimes", "": "always" },
    }));
    expect(await readLegacy(file)).toEqual({ enabled: false, projectRules: { a: "always", b: "never" } });
  });

  it("returns null for a missing or damaged file", async () => {
    expect(await readLegacy(join(dir, "none.json"))).toBeNull();
    const file = join(dir, "bad.json");
    await writeFile(file, "{");
    expect(await readLegacy(file)).toBeNull();
  });

  it("removes the file, and accepts a file that is already gone", async () => {
    const file = join(dir, "auto-pin.json");
    await writeFile(file, "{}");
    await removeLegacy(file);
    await removeLegacy(file);
    await expect(readFile(file)).rejects.toThrow();
  });
});

type Call = Parameters<typeof updateSettings>[0];

function host(initial: { revision: string; values: unknown }, legacy: unknown = null) {
  let doc = initial;
  let saves = 0;
  const call = vi.fn(async (contract: { name: string }, input: any) => {
    if (contract.name === "settings.autopin.read") return { status: "ready", ...doc };
    if (contract.name === "settings.autopin.write") {
      if (input.revision !== doc.revision) return { status: "conflict", error: "conflict" };
      doc = { revision: `r${++saves}`, values: input.values };
      return { status: "saved", ...doc };
    }
    if (contract.name === "autopin.legacy") return { values: legacy };
    throw new Error(contract.name);
  });
  return { call: call as unknown as Call, mock: call, doc: () => doc };
}

describe("client writes", () => {
  it("updates the current document", async () => {
    const h = host({ revision: "r0", values: { enabled: true, projectRules: {} } });
    await updateSettings(h.call, (values) => ({ ...values, enabled: !values.enabled }));
    expect(h.doc().values).toEqual({ enabled: false, projectRules: {} });
  });

  it("imports the 0.6 values only into a document that was never saved", async () => {
    const legacy = { enabled: false, projectRules: { a: "never" } };
    const fresh = host({ revision: "missing", values: { enabled: true, projectRules: {} } }, legacy);
    await importLegacy(fresh.call);
    expect(fresh.doc().values).toEqual(legacy);

    const saved = host({ revision: "r5", values: { enabled: true, projectRules: {} } }, legacy);
    await importLegacy(saved.call);
    expect(saved.doc().values).toEqual({ enabled: true, projectRules: {} });
    expect(saved.mock).toHaveBeenCalledTimes(1);
  });
});
