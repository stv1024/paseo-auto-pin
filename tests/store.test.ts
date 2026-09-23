import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

let dir: string;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function setup(raw?: string) {
  dir = await mkdtemp(join(tmpdir(), "auto-pin-store-test-"));
  vi.stubEnv("PASEO_HOME", dir);
  vi.resetModules();
  if (raw !== undefined) {
    await mkdir(join(dir, "plugin-data"));
    await writeFile(join(dir, "plugin-data/auto-pin.json"), raw);
  }
  return import("../server/store");
}

it.each([true, false])("migrates an existing enabled=%s setting without rewriting it", async (enabled) => {
  const raw = JSON.stringify({ enabled });
  const store = await setup(raw);
  expect(await store.getConfig()).toEqual({ enabled, projectRules: {}, revision: 0 });
  expect(await readFile(join(dir, "plugin-data/auto-pin.json"), "utf8")).toBe(raw);
});

it.each(['{"enabled":"false"}', "null", "[]", "{broken"])("uses defaults for invalid stored values: %s", async (raw) => {
  const store = await setup(raw);
  expect(await store.getConfig()).toEqual({ enabled: true, projectRules: {}, revision: 0 });
});

it("keeps valid project rules when other saved rules are invalid", async () => {
  const store = await setup(JSON.stringify({
    enabled: false, projectRules: { a: "always", b: "never", c: "default", d: true, e: {}, "": "always" },
  }));
  expect(await store.getConfig()).toEqual({
    enabled: false, projectRules: { a: "always", b: "never" }, revision: 0,
  });
});

it.each([
  [true, "default", true], [true, "always", true], [true, "never", false],
  [false, "default", false], [false, "always", true], [false, "never", false],
] as const)("default=%s, rule=%s gives pin=%s", async (enabled, rule, expected) => {
  const store = await setup(JSON.stringify({ enabled }));
  await store.setProjectRule("project", rule);
  expect(await store.shouldPinProject("project")).toBe(expected);
  expect(await store.shouldPinProject("unrelated-project")).toBe(enabled);
});

it("returns to the current default when an override is removed", async () => {
  const store = await setup('{"enabled":false}');
  await store.setProjectRule("project", "always");
  await store.setProjectRule("project", "default");
  expect((await store.getConfig()).projectRules).toEqual({});
  expect(await store.shouldPinProject("project")).toBe(false);
  await store.toggleEnabled();
  expect(await store.shouldPinProject("project")).toBe(true);
});

it("serializes mixed saves without dropping other projects or toggles", async () => {
  const store = await setup();
  const results = await Promise.all([
    store.toggleEnabled(),
    store.setProjectRule("work", "always"),
    store.setProjectRule("experiments", "never"),
    store.toggleEnabled(),
  ]);
  expect(results.map((result) => result.revision)).toEqual([1, 2, 3, 4]);
  const expected = { enabled: true, projectRules: { work: "always", experiments: "never" }, revision: 4 };
  expect(await store.getConfig()).toEqual(expected);
  expect(JSON.parse(await readFile(join(dir, "plugin-data/auto-pin.json"), "utf8"))).toEqual(expected);
  expect(await readdir(join(dir, "plugin-data"))).toEqual(["auto-pin.json"]);
  vi.resetModules();
  expect(await (await import("../server/store")).getConfig()).toEqual(expected);
});

it("keeps the previous settings after a failed save and allows retry", async () => {
  const store = await setup();
  const before = await store.getConfig();
  await writeFile(join(dir, "plugin-data"), "blocks directory creation");
  await expect(store.setProjectRule("work", "always")).rejects.toThrow();
  expect(await store.getConfig()).toEqual(before);
  await rm(join(dir, "plugin-data"));
  expect(await store.setProjectRule("work", "always")).toEqual({
    enabled: true, projectRules: { work: "always" }, revision: 1,
  });
});

it("does not let callers mutate the cached rules", async () => {
  const store = await setup();
  const saved = await store.setProjectRule("work", "always");
  saved.projectRules.work = "never";
  const read = await store.getConfig();
  read.projectRules.work = "never";
  expect(await store.shouldPinProject("work")).toBe(true);
});

it("treats project IDs as literal keys, including names inherited from Object", async () => {
  const store = await setup('{"enabled":false}');
  expect(await store.shouldPinProject("constructor")).toBe(false);
  await store.setProjectRule("__proto__", "always");
  expect(await store.shouldPinProject("__proto__")).toBe(true);
  expect(await store.shouldPinProject("unrelated")).toBe(false);
});