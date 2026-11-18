import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const projectRuleSchema = z.enum(["default", "always", "never"]);
export type ProjectRule = z.infer<typeof projectRuleSchema>;

const projectRulesSchema = z.record(z.string().min(1), z.enum(["always", "never"]));
export type ProjectRules = z.infer<typeof projectRulesSchema>;

export const valuesSchema = z.object({
  /** Pins new workspaces in projects without a rule. */
  enabled: z.boolean().default(true),
  /** Project id to rule. A project without an entry follows `enabled`. */
  projectRules: projectRulesSchema.default({}),
});
export type AutopinValues = z.infer<typeof valuesSchema>;

/** Host scope: every client of a daemon shares one default and one set of project rules. */
export const autopinSettings = defineSettings({
  id: "autopin",
  scope: "host",
  version: 1,
  schema: valuesSchema,
});

/** The revision Paseo reports for a settings document that was never saved. */
export const MISSING_REVISION = "missing";

/**
 * Auto-Pin 0.6 and earlier kept its values in `plugin-data/auto-pin.json`.
 * The client copies them into the settings document once; see `client/legacy.ts`.
 */
export const autopinLegacy = defineRpc({
  name: "autopin.legacy",
  input: z.object({}),
  output: z.object({ values: valuesSchema.nullable() }),
});

export function ruleFor(values: AutopinValues, projectId: string): ProjectRule {
  return Object.hasOwn(values.projectRules, projectId) ? values.projectRules[projectId] : "default";
}

export function shouldPin(values: AutopinValues, projectId: string): boolean {
  const rule = ruleFor(values, projectId);
  return rule === "always" || (rule === "default" && values.enabled);
}

export function withRule(values: AutopinValues, projectId: string, rule: ProjectRule): AutopinValues {
  const projectRules = { ...values.projectRules };
  if (rule === "default") delete projectRules[projectId];
  else projectRules[projectId] = rule;
  return { ...values, projectRules };
}
