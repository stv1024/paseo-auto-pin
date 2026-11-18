import { useSettings, useTranslation, type PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { autopinSettings } from "../shared/settings";
import { messages } from "./messages";

export const SCREEN_ID = "autopin";

export function AutoPinSidebarItem({ theme, currentScreen, openScreen }: PluginSidebarItemProps) {
  const settings = useSettings(autopinSettings);
  const { t } = useTranslation(messages);
  const colors = theme.colors;
  const ready = settings.status === "ready";
  const enabled = ready && settings.values.enabled;
  const busy = settings.saving;

  const open = useCallback(() => openScreen({ screenId: SCREEN_ID }), [openScreen]);
  const flip = () => {
    if (settings.status !== "ready" || settings.saving) return;
    void settings.save({ ...settings.values, enabled: !settings.values.enabled }, settings.revision);
  };

  const trailing = (
    <Pressable accessibilityRole="switch"
      accessibilityLabel={t("switch.label")}
      accessibilityState={{ checked: enabled, disabled: busy || !ready }}
      aria-checked={enabled}
      disabled={busy || !ready}
      onPress={flip}
      hitSlop={6}
      style={({ pressed }) => [styles.toggle, { opacity: pressed || busy ? 0.6 : 1 }]}>
      <Text style={[styles.state, { color: colors.foregroundMuted }]}>{ready ? t(enabled ? "switch.on" : "switch.off") : "…"}</Text>
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
