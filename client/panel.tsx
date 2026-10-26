import { useRpc, useTranslation, type PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  autopinEnsure, autopinProjects, autopinSetProjectRule, autopinToggle,
  type AutopinProject, type AutopinState, type ProjectRule,
} from "../shared/contracts";
import { messages } from "./messages";
import { publishAutopinState, useAutopinState } from "./state";

const POLL_MS = 10_000;
const RULES: ProjectRule[] = ["default", "always", "never"];

// Messages are kept as data and translated at render, so a language change
// also updates a message that is already shown.
type ReadError = "settings" | "projects";
type Feedback = { kind: "default" } | { kind: "rule"; project: string; rule: ProjectRule };

export function AutoPinPanel({ theme, layout }: PluginScreenProps) {
  const ensure = useRpc(autopinEnsure);
  const listProjects = useRpc(autopinProjects);
  const toggle = useRpc(autopinToggle);
  const setRule = useRpc(autopinSetProjectRule);
  const { enabled, running, projectRules } = useAutopinState();
  const { t } = useTranslation(messages);
  const [projects, setProjects] = useState<AutopinProject[] | null>(null);
  const [query, setQuery] = useState("");
  const [readError, setReadError] = useState<ReadError | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busyRef = useRef(false);
  const pollingRef = useRef(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const colors = theme.colors;

  const refresh = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    const generation = generationRef.current;
    setRefreshing(true);
    try {
      // A project-list failure should not hide the saved default.
      const [settings, directory] = await Promise.allSettled([ensure({}), listProjects({})]);
      if (generation !== generationRef.current) return;
      if (settings.status === "fulfilled") publishAutopinState(settings.value);
      if (directory.status === "fulfilled") setProjects(directory.value.projects);
      setReadError(settings.status === "rejected" ? "settings" : directory.status === "rejected" ? "projects" : null);
    } finally {
      if (generation === generationRef.current) {
        pollingRef.current = false;
        setRefreshing(false);
      }
    }
  }, [ensure, listProjects]);

  useEffect(() => {
    pollingRef.current = false;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => {
      generationRef.current += 1;
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const save = async (operation: () => Promise<AutopinState>, done: Feedback) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await operation();
      if (!mountedRef.current) return;
      publishAutopinState(result);
      setSaveError(false);
      setFeedback(done);
    } catch {
      if (mountedRef.current) setSaveError(true);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const search = query.trim().toLocaleLowerCase();
  const filtered = projects?.filter((project) =>
    !search || `${project.name} ${project.path}`.toLocaleLowerCase().includes(search));
  const known = enabled !== null;
  const disabled = busy || !known;
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
          accessibilityState={{ checked: enabled === true, disabled }}
          aria-checked={enabled === true}
          disabled={disabled}
          onPress={() => void save(() => toggle({}), { kind: "default" })}
          style={({ pressed }) => [styles.defaultRow, { opacity: pressed || disabled ? 0.65 : 1 }]}>
          <View style={styles.defaultCopy}>
            <Text style={[styles.label, foreground]}>{t("switch.label")}</Text>
            <Text style={[styles.small, muted]}>
              {known ? t(enabled ? "panel.defaultOn" : "panel.defaultOff") : t("panel.loadingSettings")}
            </Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.label, foreground]}>{known ? t(enabled ? "switch.on" : "switch.off") : "…"}</Text>
            <View style={[styles.switchTrack, { backgroundColor: enabled ? colors.accent : colors.surface2,
              borderColor: enabled ? colors.accent : colors.border, alignItems: enabled ? "flex-end" : "flex-start" }]}>
              <View style={[styles.switchThumb, { backgroundColor: enabled ? colors.accentForeground : colors.foregroundMuted }]} />
            </View>
          </View>
        </Pressable>
        <Text style={[styles.defaultHint, styles.small, muted, { borderColor: colors.border }]}>
          {t("panel.defaultHint")}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, foreground]}>{t("panel.projects")}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("panel.refreshLabel")}
            disabled={refreshing} onPress={() => void refresh()} style={styles.textButton}>
            <Icon name="RefreshCw" size={14} color={colors.foregroundMuted} />
            <Text style={[styles.small, muted]}>{t(refreshing ? "panel.refreshing" : "panel.refresh")}</Text>
          </Pressable>
        </View>
        <Text style={[styles.small, muted]}>
          {t("panel.rulesHint")}
        </Text>
        {projects && projects.length > 0 ? (
          <TextInput accessibilityLabel={t("panel.search")} placeholder={t("panel.search")}
            placeholderTextColor={colors.foregroundMuted} value={query} onChangeText={setQuery}
            autoCorrect={false} autoCapitalize="none"
            style={[styles.search, foreground, card]} />
        ) : null}

        {projects === null ? (
          <Text style={[styles.empty, muted]}>{t(readError ? "panel.projectsUnavailable" : "panel.loadingProjects")}</Text>
        ) : projects.length === 0 ? (
          <View style={[styles.emptyCard, card]}>
            <Text style={[styles.label, foreground]}>{t("panel.emptyTitle")}</Text>
            <Text style={[styles.small, muted]}>{t("panel.emptyHint")}</Text>
          </View>
        ) : filtered?.length === 0 ? (
          <Text style={[styles.empty, muted]}>{t("panel.noMatch", { query: query.trim() })}</Text>
        ) : (
          <View style={[styles.projectList, card]}>
            {filtered?.map((project, index) => {
              const rule = Object.hasOwn(projectRules, project.id) ? projectRules[project.id] : "default";
              const effective = rule === "always" || (rule === "default" && enabled);
              return (
                <View key={project.id} style={[styles.projectRow, {
                  borderColor: colors.border, borderTopWidth: index === 0 ? 0 : 1,
                }]}>
                  <View style={styles.projectInfo}>
                    <Text style={[styles.label, foreground]}>{project.name}</Text>
                    <Text selectable style={[styles.path, muted]}>{project.path}</Text>
                  </View>
                  <View style={styles.ruleControls}>
                    <View accessibilityRole="radiogroup" accessibilityLabel={t("panel.ruleGroup", { project: project.name })}
                      style={[styles.ruleGroup, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
                      {RULES.map((option) => (
                        <Pressable key={option} accessibilityRole="radio"
                          accessibilityLabel={t("panel.ruleOption", { project: project.name, rule: t(`rules.${option}`) })}
                          accessibilityState={{ checked: rule === option, disabled }}
                          aria-checked={rule === option}
                          disabled={disabled}
                          onPress={() => rule !== option && void save(
                            () => setRule({ projectId: project.id, rule: option }),
                            { kind: "rule", project: project.name, rule: option },
                          )}
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
                      {t(!known ? "panel.loading" : effective ? "panel.willPin" : "panel.willStayUnpinned")}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {saveError ? <Text accessibilityRole="alert" style={[styles.small, { color: colors.statusDanger }]}>{t("errors.save")}</Text> : null}
      {readError ? (
        <View style={styles.errorRow}>
          <Text accessibilityRole="alert" style={[styles.small, { color: colors.statusDanger, flex: 1 }]}>{t(`errors.${readError}`)}</Text>
          <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void refresh()} style={styles.textButton}>
            <Text style={[styles.label, { color: colors.accent }]}>{t("panel.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[styles.small, muted]}>
        {status}
      </Text>

      <View style={[styles.footer, { borderColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Icon name={running ? "Check" : "CircleDashed"} size={14}
            color={readError ? colors.statusWarning : running ? colors.statusSuccess : colors.foregroundMuted} />
          <Text style={[styles.small, muted]}>
            {t(readError ? "panel.connectionProblem" : running === null ? "panel.connecting" : running ? "panel.ready" : "panel.notReady")}
          </Text>
        </View>
        <Text style={[styles.small, muted]}>
          {t("panel.footer")}
        </Text>
      </View>
    </ScrollView>
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
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
