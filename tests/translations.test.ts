import { expect, it } from "vitest";
import en from "../client/locales/en.json";
import zhCN from "../client/locales/zh-CN.json";

type Resource = { [key: string]: string | Resource };

function keys(resource: Resource, prefix = ""): string[] {
  return Object.entries(resource).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`));
}

it("defines the resources the SDK accepts: known keys and matching placeholders", async () => {
  const { messages } = await import("../client/messages");
  expect(Object.keys(messages.resources)).toEqual(["en", "zh-CN"]);
  expect(() => messages.message("panel.noMatch", { query: "x" })).not.toThrow();
});

it("translates every English message into Simplified Chinese", () => {
  expect(keys(zhCN).sort()).toEqual(keys(en).sort());
});

it("keeps the product name at the start of every command title", () => {
  for (const resource of [en, zhCN]) {
    for (const title of Object.values(resource.commands)) expect(title).toMatch(/^Auto-Pin[:：]/);
  }
});
