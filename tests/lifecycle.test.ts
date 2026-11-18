import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginHookContext, PluginHookPayload, PluginServerContext } from "@getpaseo/plugin/server";
import { currentValues, registerAutoPin, type AutopinSettings } from "../server/lifecycle";
import { readLegacy } from "../server/legacy";
import type { AutopinValues } from "../shared/settings";

vi.mock("../server/legacy", () => ({ readLegacy: vi.fn(async () => null) }));
afterEach(() => vi.clearAllMocks());

function settingsWith(values: AutopinValues, revision = "r1"): AutopinSettings {
  return {
    read: vi.fn(async () => ({ status: "ready" as const, revision, values })),
    subscribe: vi.fn(() => () => {}),
  };
}

function setup(values: AutopinValues = { enabled: true, projectRules: {} }, settings = settingsWith(values)) {
  let handler!: (payload: PluginHookPayload<"workspace.create.after">, context: PluginHookContext) => Promise<void>;
  const remove = vi.fn();
  const addHook = vi.fn((name: string, fn: typeof handler) => {
    expect(name).toBe("workspace.create.after");
    handler = fn;
    return remove;
  });
  const cleanup = registerAutoPin({ addHook } as unknown as PluginServerContext, settings);
  const setPinned = vi.fn(async () => ({ pinnedAt: "now" }));
  const ref = vi.fn(() => ({ setPinned }));
  const controller = new AbortController();
  const payload = {
    workspace: { id: "new", projectId: "p", cwd: "/tmp", name: null, archivedAt: null as string | null, metadata: {} },
  };
  const context = { signal: controller.signal, paseo: { workspaces: { ref } } } as unknown as PluginHookContext;
  return { fire: () => handler(payload, context), cleanup, remove, payload, controller, ref, setPinned };
}

describe("workspace.create.after hook", () => {
  it("pins new workspaces through the Paseo API and removes the hook on unload", async () => {
    const s = setup();
    await s.fire();
    expect(s.ref).toHaveBeenCalledExactlyOnceWith("new");
    expect(s.setPinned).toHaveBeenCalledExactlyOnceWith(true);
    s.cleanup();
    expect(s.remove).toHaveBeenCalledOnce();
  });

  it("follows the project rule over the default", async () => {
    const never = setup({ enabled: true, projectRules: { p: "never" } });
    await never.fire();
    expect(never.setPinned).not.toHaveBeenCalled();
    const always = setup({ enabled: false, projectRules: { p: "always" } });
    await always.fire();
    expect(always.setPinned).toHaveBeenCalledOnce();
    const off = setup({ enabled: false, projectRules: {} });
    await off.fire();
    expect(off.setPinned).not.toHaveBeenCalled();
  });

  it("ignores archived workspaces and canceled hooks", async () => {
    const s = setup();
    s.payload.workspace.archivedAt = new Date().toISOString();
    await s.fire();
    s.payload.workspace.archivedAt = null;
    s.controller.abort();
    await s.fire();
    expect(s.setPinned).not.toHaveBeenCalled();
  });

  it("reports pin failures to the hook host", async () => {
    const s = setup();
    s.setPinned.mockRejectedValueOnce(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(s.fire()).rejects.toThrow("offline");
    log.mockRestore();
  });

  it("does not report a failure that follows cancellation", async () => {
    const s = setup();
    s.setPinned.mockImplementationOnce(async () => {
      s.controller.abort();
      throw s.controller.signal.reason;
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(s.fire()).resolves.toBeUndefined();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not pin when the stored settings are invalid", async () => {
    const settings: AutopinSettings = {
      read: vi.fn(async () => ({ status: "invalid" as const, revision: "r1", error: "bad" })),
      subscribe: vi.fn(() => () => {}),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = setup(undefined, settings);
    await s.fire();
    expect(s.setPinned).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("currentValues", () => {
  it("uses the 0.6 file until the settings document exists", async () => {
    vi.mocked(readLegacy).mockResolvedValueOnce({ enabled: false, projectRules: { p: "always" } });
    expect(await currentValues(settingsWith({ enabled: true, projectRules: {} }, "missing")))
      .toEqual({ enabled: false, projectRules: { p: "always" } });
  });

  it("uses the defaults when neither exists", async () => {
    expect(await currentValues(settingsWith({ enabled: true, projectRules: {} }, "missing")))
      .toEqual({ enabled: true, projectRules: {} });
  });

  it("ignores the 0.6 file once settings are saved", async () => {
    vi.mocked(readLegacy).mockResolvedValue({ enabled: false, projectRules: {} });
    expect(await currentValues(settingsWith({ enabled: true, projectRules: {} }, "r2")))
      .toEqual({ enabled: true, projectRules: {} });
    expect(readLegacy).not.toHaveBeenCalled();
    vi.mocked(readLegacy).mockReset();
  });
});
