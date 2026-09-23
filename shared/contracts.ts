import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const projectRuleSchema = z.enum(["default", "always", "never"]);
export type ProjectRule = z.infer<typeof projectRuleSchema>;
export type ProjectRules = Record<string, Exclude<ProjectRule, "default">>;

const stateSchema = z.object({
  running: z.boolean(),
  enabled: z.boolean(),
  projectRules: z.record(z.string(), z.enum(["always", "never"])),
  revision: z.number().int().nonnegative(),
});
export type AutopinState = z.infer<typeof stateSchema>;

const projectSchema = z.object({ id: z.string(), name: z.string(), path: z.string() });
export type AutopinProject = z.infer<typeof projectSchema>;

/** The legacy name is retained for existing clients. This only reads status. */
export const autopinEnsure = defineRpc({
  name: "autopin.ensure",
  input: z.object({}),
  output: stateSchema,
});

/** Flips the default. Explicit project rules still take precedence. */
export const autopinToggle = defineRpc({
  name: "autopin.toggle",
  input: z.object({}),
  output: stateSchema,
});

export const autopinProjects = defineRpc({
  name: "autopin.projects",
  input: z.object({}),
  output: z.object({ projects: z.array(projectSchema) }),
});

export const autopinSetProjectRule = defineRpc({
  name: "autopin.set-project-rule",
  input: z.object({ projectId: z.string().min(1), rule: projectRuleSchema }),
  output: stateSchema,
});
