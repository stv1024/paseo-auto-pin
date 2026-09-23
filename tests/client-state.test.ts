import { expect, it, vi } from "vitest";

it("keeps a saved project rule when an older poll or command response arrives late", async () => {
  vi.resetModules();
  const { getAutopinState, publishAutopinState } = await import("../client/state");
  const saved = { running: true, enabled: true, projectRules: { experiments: "never" as const }, revision: 3 };
  publishAutopinState(saved);
  publishAutopinState({ running: true, enabled: false, projectRules: {}, revision: 2 });
  expect(getAutopinState()).toEqual(saved);
});

it("accepts newer settings from another client and hook status changes without a save", async () => {
  vi.resetModules();
  const { getAutopinState, publishAutopinState } = await import("../client/state");
  publishAutopinState({ running: true, enabled: true, projectRules: {}, revision: 1 });
  publishAutopinState({ running: true, enabled: false, projectRules: { work: "always" }, revision: 2 });
  publishAutopinState({ running: false, enabled: false, projectRules: { work: "always" }, revision: 2 });
  expect(getAutopinState()).toEqual({ running: false, enabled: false, projectRules: { work: "always" }, revision: 2 });
});
