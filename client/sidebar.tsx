import { useRpc, type PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { autopinEnsure, autopinToggle } from "../shared/contracts";
import { publishAutopinState, useAutopinState } from "./state";

export const SCREEN_ID = "autopin";
// Picks up changes made on other clients; same-client changes arrive through the store.
const POLL_MS = 60_000;

export function AutoPinSidebarItem({ theme, currentScreen, openScreen }: PluginSidebarItemProps) {
  const ensure = useRpc(autopinEnsure);
  const toggle = useRpc(autopinToggle);
  const { enabled } = useAutopinState();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const colors = theme.colors;

  useEffect(() => {
    const timer = setInterval(() => {
      ensure({}).then(publishAutopinState).catch(() => { /* The panel reports connection failures. */ });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [ensure]);

  const open = useCallback(() => openScreen({ screenId: SCREEN_ID }), [openScreen]);
  const flip = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      publishAutopinState(await toggle({}));
    } catch {
      // Leave the previous state visible; the panel shows connection errors.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [toggle]);

  const known = enabled !== null;
  const trailing = (
    <Pressable accessibilityRole="switch"
      accessibilityLabel="Pin new workspaces by default"
      accessibilityState={{ checked: enabled === true, disabled: busy || !known }}
      aria-checked={enabled === true}
      disabled={busy || !known}
      onPress={() => void flip()}
      hitSlop={6}
      style={({ pressed }) => [styles.toggle, { opacity: pressed || busy ? 0.6 : 1 }]}>
      <Text style={[styles.state, { color: colors.foregroundMuted }]}>{known ? enabled ? "On" : "Off" : "…"}</Text>
      <View style={[styles.track, {
        backgroundColor: enabled ? colors.accent : colors.surface2,
        borderColor: enabled ? colors.accent : colors.border,
        alignItems: enabled ? "flex-end" : "flex-start",
      }]}>
        <View style={[styles.thumb, { backgroundColor: enabled ? colors.accentForeground : colors.foregroundMuted }]} />
      </View>
    </Pressable>
  );

  return <SidebarRow icon="Pin" active={currentScreen?.screenId === SCREEN_ID} onPress={open} trailing={trailing} />;
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  state: { fontSize: 11, lineHeight: 14 },
  track: { width: 26, height: 16, borderRadius: 8, borderWidth: 1, padding: 2, justifyContent: "center" },
  thumb: { width: 10, height: 10, borderRadius: 5 },
});
