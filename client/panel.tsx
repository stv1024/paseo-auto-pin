import { useProject, useProjects, useSettings, useTranslation, type PluginScreenProps, type ProjectRef } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { autopinSettings, ruleFor, shouldPin, withRule, type AutopinValues, type ProjectRule } from "../shared/settings";
import { messages } from "./messages";

const RULES: ProjectRule[] = ["default", "always", "never"];

// Messages are kept as data and translated at render, so a language change
// also updates a message that is already shown.
type Feedback = { kind: "default" } | { kind: "rule"; project: string; rule: ProjectRule };
type Colors = PluginScreenProps["theme"]["colors"];

export function AutoPinPanel({ theme, layout, host }: PluginScreenProps) {
  const settings = useSettings(autopinSettings);
  const { t } = useTranslation(messages);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const search = query.trim().toLocaleLowerCase();
  const all = useProjects({ hosts: [host.id] });
  const projects = useProjects({
    hosts: [host.id],
    where: (project) => !search || `${project.displayName} ${project.rootPath}`.toLocaleLowerCase().includes(search),
    orderBy: (a, b) => a.displayName.localeCompare(b.displayName) || a.rootPath.localeCompare(b.rootPath),
  });
  const colors = theme.colors;

  const values = settings.status === "ready" ? settings.values : null;
  const busy = settings.saving;
  const disabled = busy || values === null;
  const save = async (next: AutopinValues, done: Feedback) => {
    if (settings.status !== "ready" || settings.saving) return;
    setFeedback(null);
    if (await settings.save(next, settings.revision)) setFeedback(done);
  };

  const muted = { color: colors.foregroundMuted };
  const foreground = { color: colors.foreground };
  const card = { backgroundColor: colors.surface1, borderColor: colors.border };
  const status = busy ? t("panel.saving")
    : feedback === null ? t("panel.autosave")
    : feedback.kind === "default" ? t("panel.defaultSaved")
    : t("panel.ruleSaved", { project: feedback.project, rule: t(`rules.${feedback.rule}`) });

  return (
    <ScrollView testID="auto-pin-panel" style={{ flex: 1, backgroundColor: colors.surface0 }}
      contentContainerStyle={[styles.screen, { padding: layout.compact ? 16 : 28 }]}>
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <Icon name="Pin" size={22} color={colors.accent} />
          <Text accessibilityRole="header" style={[styles.title, foreground]}>Auto-Pin</Text>
        </View>
        <Text style={[styles.description, muted]}>
          {t("panel.intro")}
        </Text>
      </View>

      <View style={[styles.card, card]}>
        <Pressable accessibilityRole="switch"
          accessibilityLabel={t("switch.label")}
          accessibilityState={{ checked: values?.enabled === true, disabled }}
          aria-checked={values?.enabled === true}
          disabled={disabled}
          onPress={() => values && void save({ ...values, enabled: !values.enabled }, { kind: "default" })}
          style={({ pressed }) => [styles.defaultRow, { opacity: pressed || disabled ? 0.65 : 1 }]}>
          <View style={styles.defaultCopy}>
            <Text style={[styles.label, foreground]}>{t("switch.label")}</Text>
            <Text style={[styles.small, muted]}>
              {values ? t(values.enabled ? "panel.defaultOn" : "panel.defaultOff") : t("panel.loadingSettings")}
            </Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.label, foreground]}>{values ? t(values.enabled ? "switch.on" : "switch.off") : "…"}</Text>
            <Switch on={values?.enabled === true} colors={colors} />
          </View>
        </Pressable>
        <Text style={[styles.defaultHint, styles.small, muted, { borderColor: colors.border }]}>
          {t("panel.defaultHint")}
        </Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, foreground]}>{t("panel.projects")}</Text>
        <Text style={[styles.small, muted]}>
          {t("panel.rulesHint")}
        </Text>
        {all.length > 0 ? (
          <TextInput accessibilityLabel={t("panel.search")} placeholder={t("panel.search")}
            placeholderTextColor={colors.foregroundMuted} value={query} onChangeText={setQuery}
            autoCorrect={false} autoCapitalize="none"
            style={[styles.search, foreground, card]} />
        ) : null}

        {all.length === 0 ? (
          <View style={[styles.emptyCard, card]}>
            <Text style={[styles.label, foreground]}>{t("panel.emptyTitle")}</Text>
            <Text style={[styles.small, muted]}>{t("panel.emptyHint")}</Text>
          </View>
        ) : projects.length === 0 ? (
          <Text style={[styles.empty, muted]}>{t("panel.noMatch", { query: query.trim() })}</Text>
        ) : (
          <View style={[styles.projectList, card]}>
            {projects.map((ref, index) => (
              <ProjectRow key={ref.key} projectRef={ref} first={index === 0} values={values} busy={busy}
                colors={colors} onRule={(project, rule) => values && void save(
                  withRule(values, ref.id, rule), { kind: "rule", project, rule },
                )} />
            ))}
          </View>
        )}
      </View>

      {settings.saveError ? (
        <Text accessibilityRole="alert" style={[styles.small, { color: colors.statusDanger }]}>{t("errors.save")}</Text>
      ) : null}
      {settings.status === "error" || settings.status === "invalid" ? (
        <View style={styles.errorRow}>
          <Text accessibilityRole="alert" style={[styles.small, { color: colors.statusDanger, flex: 1 }]}>
            {t(settings.status === "error" ? "errors.settings" : "errors.invalid")}
          </Text>
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => void (settings.status === "error" ? settings.reload() : settings.reset())}
            style={styles.textButton}>
            <Text style={[styles.label, { color: colors.accent }]}>
              {t(settings.status === "error" ? "panel.retry" : "panel.resetSettings")}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[styles.small, muted]}>
        {status}
      </Text>

      <View style={[styles.footer, { borderColor: colors.border }]}>
        <Text style={[styles.small, muted]}>
          {t("panel.footer")}
        </Text>
      </View>
    </ScrollView>
  );
}

function ProjectRow({ projectRef, first, values, busy, colors, onRule }: {
  projectRef: ProjectRef;
  first: boolean;
  values: AutopinValues | null;
  busy: boolean;
  colors: Colors;
  onRule(project: string, rule: ProjectRule): void;
}) {
  const project = useProject(projectRef);
  const { t } = useTranslation(messages);
  if (!project) return null;
  const rule = values ? ruleFor(values, projectRef.id) : "default";
  const disabled = busy || values === null;
  const muted = { color: colors.foregroundMuted };
  return (
    <View style={[styles.projectRow, { borderColor: colors.border, borderTopWidth: first ? 0 : 1 }]}>
      <View style={styles.projectInfo}>
        <Text style={[styles.label, { color: colors.foreground }]}>{project.displayName}</Text>
        <Text selectable style={[styles.path, muted]}>{project.rootPath}</Text>
      </View>
      <View style={styles.ruleControls}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t("panel.ruleGroup", { project: project.displayName })}
          style={[styles.ruleGroup, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
          {RULES.map((option) => (
            <Pressable key={option} accessibilityRole="radio"
              accessibilityLabel={t("panel.ruleOption", { project: project.displayName, rule: t(`rules.${option}`) })}
              accessibilityState={{ checked: rule === option, disabled }}
              aria-checked={rule === option}
              disabled={disabled}
              onPress={() => rule !== option && onRule(project.displayName, option)}
              style={({ pressed }) => [styles.ruleButton, {
                backgroundColor: rule === option ? colors.accent : "transparent",
                opacity: pressed || busy ? 0.65 : 1,
              }]}>
              <Text style={[styles.ruleLabel, {
                color: rule === option ? colors.accentForeground : colors.foregroundMuted,
              }]}>{t(`rules.${option}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.small, muted]}>
          {t(!values ? "panel.loading" : shouldPin(values, projectRef.id) ? "panel.willPin" : "panel.willStayUnpinned")}
        </Text>
      </View>
    </View>
  );
}

function Switch({ on, colors }: { on: boolean; colors: Colors }) {
  return (
    <View style={[styles.switchTrack, { backgroundColor: on ? colors.accent : colors.surface2,
      borderColor: on ? colors.accent : colors.border, alignItems: on ? "flex-end" : "flex-start" }]}>
      <View style={[styles.switchThumb, { backgroundColor: on ? colors.accentForeground : colors.foregroundMuted }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 24, maxWidth: 760, width: "100%" },
  heading: { gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 24, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  defaultCopy: { flex: 1, gap: 5 },
  label: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 18 },
  defaultHint: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  switchTrack: { width: 38, height: 24, borderRadius: 12, borderWidth: 1, padding: 3, justifyContent: "center" },
  switchThumb: { width: 16, height: 16, borderRadius: 8 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  textButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 4 },
  search: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  empty: { fontSize: 13, lineHeight: 20, paddingVertical: 20 },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 20, gap: 6 },
  projectList: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  projectRow: { padding: 16, gap: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  projectInfo: { gap: 4, flexBasis: 240, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  path: { fontSize: 11, lineHeight: 16, flexShrink: 1 },
  ruleControls: { gap: 8, alignItems: "flex-start" },
  ruleGroup: { flexDirection: "row", borderRadius: 8, borderWidth: 1, padding: 3 },
  ruleButton: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5, justifyContent: "center" },
  ruleLabel: { fontSize: 12, fontWeight: "500" },
  errorRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  footer: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
});
