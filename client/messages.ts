import { defineTranslations } from "@getpaseo/plugin/client";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

// Languages without a resource, and keys a resource omits, fall back to English.
export const messages = defineTranslations({ resources: { en, "zh-CN": zhCN } });
