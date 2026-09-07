import { useSyncExternalStore } from "react";

/**
 * Module-scope state shared by everything running in this client bundle: the
 * command-center toggle, the sidebar panel, and the connect-time ensure kick.
 * This is what lets a command-palette toggle update an open panel instantly —
 * plugin RPC is request/response only (no push channel in Paseo 0.7.2), so
 * same-client feedback goes through this store and cross-client drift is
 * covered by the panel's slow poll.
 */
export type AutopinClientState = {
  enabled: boolean | null;
  running: boolean | null;
};

let state: AutopinClientState = { enabled: null, running: null };
const listeners = new Set<() => void>();

export function publishAutopinState(next: Partial<AutopinClientState>): void {
  const merged = { ...state, ...next };
  if (merged.enabled === state.enabled && merged.running === state.running) return;
  state = merged;
  for (const listener of listeners) listener();
}

function getAutopinState(): AutopinClientState {
  return state;
}

function subscribeAutopinState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutopinState(): AutopinClientState {
  return useSyncExternalStore(subscribeAutopinState, getAutopinState, getAutopinState);
}
