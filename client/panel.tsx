import { useRpc, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { autopinEnsure, autopinToggle } from "../shared/contracts";
import { publishAutopinState, useAutopinState } from "./state";

// The store handles same-client updates; this poll only reconciles changes
// made from other clients, so it can be slow.
const POLL_MS = 10_000;

export function AutoPinPanel({ theme, layout }: PluginSurfaceProps) {
  const ensure = useRpc(autopinEnsure);
  const toggle = useRpc(autopinToggle);
  const { enabled, running } = useAutopinState();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let polling = false;
    const poll = async () => {
      // Skip the reconcile poll while a toggle is in flight so a stale read
      // can't briefly flip the switch back.
      if (busyRef.current || polling) return;
      polling = true;
      try {
        const result = await ensure({});
        if (disposed || busyRef.current) return;
        publishAutopinState(result);
        setError(null);
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [ensure]);

  const handleToggle = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await toggle({});
      publishAutopinState(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [toggle]);

  const styles = useMemo(
    () => ({
      screen: {
        backgroundColor: theme.colors.surface0,
        flex: 1,
        gap: 20,
        maxWidth: 640,
        padding: layout.compact ? 16 : 24,
      },
      title: {
        color: theme.colors.foreground,
        fontSize: layout.compact ? 20 : 24,
        fontWeight: "700" as const,
      },
      description: {
        color: theme.colors.foregroundMuted,
        fontSize: 13,
        lineHeight: 18,
      },
      toggleCard: {
        alignItems: "center" as const,
        backgroundColor: theme.colors.surface1,
        borderColor: enabled ? theme.colors.accent : theme.colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        paddingHorizontal: 14,
        paddingVertical: 12,
      },
      toggleTextContainer: {
        flex: 1,
        gap: 2,
        paddingRight: 12,
      },
      toggleTitle: {
        color: theme.colors.foreground,
        fontSize: 14,
        fontWeight: "500" as const,
      },
      toggleDescription: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        lineHeight: 16,
      },
      statusRow: {
        alignItems: "center" as const,
        flexDirection: "row" as const,
        gap: 8,
      },
      statusText: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
      },
      error: {
        color: theme.colors.statusDanger,
        fontSize: 13,
      },
    }),
    [enabled, layout.compact, theme],
  );

  const stateKnown = enabled !== null;
  const stateLabel = !stateKnown ? "Loading…" : enabled ? "Enabled" : "Disabled";
  const stateColor = !stateKnown
    ? theme.colors.foregroundMuted
    : enabled
      ? theme.colors.statusSuccess
      : theme.colors.foregroundMuted;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Auto-Pin</Text>
      <Text style={styles.description}>
        Automatically pins newly created workspaces so active work stays at the top of the
        sidebar. Unarchiving an old workspace does not pin it.
      </Text>

      <Pressable
        accessibilityLabel={`Auto-pin new workspaces, ${stateLabel.toLowerCase()}`}
        accessibilityRole="switch"
        aria-checked={enabled === true}
        disabled={busy || !stateKnown}
        onPress={handleToggle}
        style={styles.toggleCard}
      >
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleTitle}>Pin new workspaces</Text>
          <Text style={styles.toggleDescription}>
            Also toggleable from the Command Center: Auto-Pin: Toggle
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Icon
            color={stateColor}
            name={!stateKnown ? "Loader" : enabled ? "Pin" : "PinOff"}
            size={16}
          />
          <Text style={[styles.statusText, { color: stateColor, fontWeight: "600" as const }]}>
            {busy ? "Switching…" : stateLabel}
          </Text>
        </View>
      </Pressable>

      <View style={styles.statusRow}>
        <Icon
          color={running ? theme.colors.statusSuccess : theme.colors.foregroundMuted}
          name={running ? "Activity" : "CircleDashed"}
          size={14}
        />
        <Text style={styles.statusText}>
          {running === null
            ? "Hook status unknown"
            : running
              ? "Workspace-created hook active"
              : "Workspace-created hook inactive"}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
