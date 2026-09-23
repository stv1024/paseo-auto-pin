import { useSyncExternalStore } from "react";
import type { AutopinState } from "../shared/contracts";

// Shared by the panel and Command Center within this client. The revision
// prevents a delayed poll from undoing a more recent mutation response.
export type AutopinClientState = Omit<AutopinState, "enabled" | "running"> & {
  enabled: boolean | null;
  running: boolean | null;
};

let state: AutopinClientState = { enabled: null, running: null, projectRules: {}, revision: -1 };
const listeners = new Set<() => void>();

export function publishAutopinState(next: AutopinState): void {
  if (next.revision < state.revision) return;
  if (next.revision === state.revision && next.running === state.running) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getAutopinState(): AutopinClientState { return state; }

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAutopinState(): AutopinClientState {
  return useSyncExternalStore(subscribe, getAutopinState, getAutopinState);
}