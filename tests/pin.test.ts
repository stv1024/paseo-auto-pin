import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { pinWorkspace } from "../server/pin";

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  setWorkspacePinned: vi.fn(),
  close: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("../server/store", () => ({ PASEO_HOME: "/paseo-test" }));
vi.mock("@getpaseo/client/internal/daemon-client", () => ({
  DaemonClient: vi.fn(function () { return client; }),
}));

beforeEach(() => {
  vi.mocked(readFile).mockRejectedValue(new Error("no config"));
  client.connect.mockResolvedValue(undefined);
  client.setWorkspacePinned.mockResolvedValue(undefined);
  client.close.mockResolvedValue(undefined);
});
afterEach(() => vi.resetAllMocks());

describe("Paseo 0.9.1 pin transport", () => {
  it.each([
    [undefined, "ws://127.0.0.1:6767/ws"],
    ["127.0.0.1:7777", "ws://127.0.0.1:7777/ws"],
    ["0.0.0.0:7777", "ws://127.0.0.1:7777/ws"],
  ])("pins via the configured local daemon (%s) and closes", async (listen, url) => {
    if (listen) vi.mocked(readFile).mockResolvedValue(JSON.stringify({ daemon: { listen } }));
    await pinWorkspace("new", new AbortController().signal);
    expect(DaemonClient).toHaveBeenCalledWith(expect.objectContaining({
      url, connectTimeoutMs: 5_000, reconnect: { enabled: false },
    }));
    expect(client.setWorkspacePinned).toHaveBeenCalledExactlyOnceWith("new", true);
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("closes on connection failure and preserves the error", async () => {
    client.connect.mockRejectedValueOnce(new Error("offline"));
    await expect(pinWorkspace("new", new AbortController().signal)).rejects.toThrow("offline");
    expect(client.setWorkspacePinned).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("closes when the daemon rejects the pin", async () => {
    client.setWorkspacePinned.mockRejectedValueOnce(new Error("workspace not found"));
    await expect(pinWorkspace("new", new AbortController().signal)).rejects.toThrow("workspace not found");
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("does not open a connection for an already canceled hook", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(pinWorkspace("new", controller.signal)).rejects.toBe(controller.signal.reason);
    expect(readFile).not.toHaveBeenCalled();
    expect(DaemonClient).not.toHaveBeenCalled();
  });

  it("does not connect when canceled while reading daemon configuration", async () => {
    const controller = new AbortController();
    vi.mocked(readFile).mockImplementationOnce(async () => {
      controller.abort();
      return "{}";
    });
    await expect(pinWorkspace("new", controller.signal)).rejects.toBe(controller.signal.reason);
    expect(DaemonClient).not.toHaveBeenCalled();
  });

  it("finishes cancellation even if connect never settles, without pinning on a late connection", async () => {
    const controller = new AbortController();
    let connected!: () => void;
    client.connect.mockReturnValueOnce(new Promise<void>((resolve) => { connected = resolve; }));
    const result = pinWorkspace("new", controller.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    expect(client.close).toHaveBeenCalledOnce();
    connected();
    await Promise.resolve();
    expect(client.setWorkspacePinned).not.toHaveBeenCalled();
  });

  it("closes promptly when a pin request is canceled", async () => {
    const controller = new AbortController();
    client.setWorkspacePinned.mockReturnValueOnce(new Promise(() => {}));
    const result = pinWorkspace("new", controller.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(client.setWorkspacePinned).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("removes the cancellation listener after success", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await pinWorkspace("new", controller.signal);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    controller.abort();
    expect(client.close).toHaveBeenCalledOnce();
    remove.mockRestore();
  });
});
