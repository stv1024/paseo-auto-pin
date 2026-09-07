import { defineRpc } from "@getpaseo/plugin/server";
import { z } from "zod";

/** Starts the workspace watcher (idempotent) and reports current state. */
export const autopinEnsure = defineRpc({
  name: "autopin.ensure",
  input: z.object({}),
  output: z.object({
    running: z.boolean(),
    enabled: z.boolean(),
  }),
});

/** Flips the auto-pin switch and returns the new state. */
export const autopinToggle = defineRpc({
  name: "autopin.toggle",
  input: z.object({}),
  output: z.object({
    enabled: z.boolean(),
  }),
});
