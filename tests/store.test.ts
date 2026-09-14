import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
let dir: string;
afterEach(async () => { vi.unstubAllEnvs(); if (dir) await rm(dir, { recursive: true, force: true }); });
async function setup(raw?: string) {
  dir = await mkdtemp(join(tmpdir(), "auto-pin-store-test-"));
  vi.stubEnv("PASEO_HOME", dir); vi.resetModules();
  if (raw !== undefined) { await mkdir(join(dir, "plugin-data")); await writeFile(join(dir, "plugin-data/auto-pin.json"), raw); }
  return import("../server/store");
}
it("preserves an existing disabled config", async () => {
  const store = await setup('{"enabled":false}'); expect(await store.isEnabled()).toBe(false);
});
it("validates stored values", async () => {
  const store = await setup('{"enabled":"false"}'); expect(await store.isEnabled()).toBe(true);
});
it("serializes concurrent toggles and persists the final value", async () => {
  const store = await setup();
  expect(await Promise.all([store.toggleEnabled(), store.toggleEnabled()])).toEqual([false, true]);
  expect(JSON.parse(await readFile(join(dir, "plugin-data/auto-pin.json"), "utf8"))).toEqual({ enabled: true });
});
it("does not update cached state after a failed write and allows a retry", async () => {
  const store = await setup(); expect(await store.isEnabled()).toBe(true);
  await writeFile(join(dir, "plugin-data"), "blocks directory creation");
  await expect(store.toggleEnabled()).rejects.toThrow(); expect(await store.isEnabled()).toBe(true);
  await rm(join(dir, "plugin-data")); expect(await store.toggleEnabled()).toBe(false);
});
