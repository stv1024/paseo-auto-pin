import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginServerContext, PluginHookContext, PluginLifecycleEvents } from "@getpaseo/plugin/server";
import { registerAutoPin, isRunning } from "../server/lifecycle";
import { shouldPinProject } from "../server/store";
import { pinWorkspace } from "../server/pin";

vi.mock("../server/store", () => ({ shouldPinProject: vi.fn(async () => true) }));
vi.mock("../server/pin", () => ({ pinWorkspace: vi.fn(async () => {}) }));
afterEach(() => vi.clearAllMocks());

function setup() {
  let handler!: (event: PluginLifecycleEvents["workspace.created"], context: PluginHookContext) => void | Promise<void>;
  const unsubscribe = vi.fn();
  const on = vi.fn((name, fn) => { expect(name).toBe("workspace.created"); handler = fn; return unsubscribe; });
  const cleanup = registerAutoPin({ on } as unknown as PluginServerContext);
  const controller = new AbortController();
  const event = { workspace: { id: "new", projectId: "p", cwd: "/tmp", name: null, archivedAt: null as string | null } };
  const context = { signal: controller.signal } as PluginHookContext;
  return { fire: () => handler(event, context), cleanup, unsubscribe, event, controller };
}

describe("workspace-created lifecycle", () => {
  it("pins new workspaces and unregisters on unload", async () => {
    const s = setup();
    expect(isRunning()).toBe(true);
    await s.fire();
    expect(shouldPinProject).toHaveBeenCalledExactlyOnceWith("p");
    expect(pinWorkspace).toHaveBeenCalledExactlyOnceWith("new", s.controller.signal);
    s.cleanup();
    expect(isRunning()).toBe(false);
    expect(s.unsubscribe).toHaveBeenCalledOnce();
  });
  it("respects the project rule decision", async () => {
    vi.mocked(shouldPinProject).mockResolvedValueOnce(false);
    const s = setup(); await s.fire(); s.cleanup();
    expect(pinWorkspace).not.toHaveBeenCalled();
  });
  it("ignores archived workspaces and aborted hooks", async () => {
    const s = setup(); s.event.workspace.archivedAt = new Date().toISOString();
    await s.fire(); s.event.workspace.archivedAt = null; s.controller.abort();
    await s.fire(); s.cleanup();
    expect(pinWorkspace).not.toHaveBeenCalled();
  });
  it("reports pin failures to the lifecycle host", async () => {
    vi.mocked(pinWorkspace).mockRejectedValueOnce(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = setup(); await expect(s.fire()).rejects.toThrow("offline"); s.cleanup(); log.mockRestore();
  });
  it("does not pin when canceled while reading the rules", async () => {
    const s = setup();
    vi.mocked(shouldPinProject).mockImplementationOnce(async () => {
      s.controller.abort();
      return true;
    });
    await s.fire(); s.cleanup();
    expect(pinWorkspace).not.toHaveBeenCalled();
  });
  it("does not report expected cancellation as a pin failure", async () => {
    const s = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(pinWorkspace).mockImplementationOnce(async () => {
      s.controller.abort();
      throw s.controller.signal.reason;
    });
    try {
      await expect(s.fire()).resolves.toBeUndefined();
      expect(log).not.toHaveBeenCalled();
    } finally {
      s.cleanup(); log.mockRestore();
    }
  });
});
