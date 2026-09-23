import { useRpc, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  autopinEnsure, autopinProjects, autopinSetProjectRule, autopinToggle,
  type AutopinProject, type AutopinState, type ProjectRule,
} from "../shared/contracts";
import { publishAutopinState, useAutopinState } from "./state";

const POLL_MS = 10_000;
const RULES: { value: ProjectRule; label: string }[] = [
  { value: "default", label: "Follow default" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
];

export function AutoPinPanel({ theme, layout }: PluginSurfaceProps) {
  const ensure = useRpc(autopinEnsure);
  const listProjects = useRpc(autopinProjects);
  const toggle = useRpc(autopinToggle);
  const setRule = useRpc(autopinSetProjectRule);
  const { enabled, running, projectRules } = useAutopinState();
  const [projects, setProjects] = useState<AutopinProject[] | null>(null);
  const [query, setQuery] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
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
      setReadError(settings.status === "rejected"
        ? "Couldn't refresh your settings. Check your connection and try again."
        : directory.status === "rejected"
          ? "Couldn't load projects. Check your connection and try again."
          : null);
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

  const save = async (operation: () => Promise<AutopinState>, message: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const result = await operation();
      if (!mountedRef.current) return;
      publishAutopinState(result);
      setSaveError(null);
      setFeedback(message);
    } catch {
      if (mountedRef.current) {
        setSaveError("Couldn't confirm that change. Check your connection, refresh, and try again.");
      }
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

  return (
    <ScrollView testID="auto-pin-panel" style={{ flex: 1, backgroundColor: colors.surface0 }}
      contentContainerStyle={[styles.screen, { padding: layout.compact ? 16 : 28 }]}>
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <Icon name="Pin" size={22} color={colors.accent} />
          <Text accessibilityRole="header" style={[styles.title, foreground]}>Auto-Pin</Text>
        </View>
        <Text style={[styles.description, muted]}>
          Keep new workspaces within reach. Choose a default, then make exceptions for individual projects.
        </Text>
      </View>

      <View style={[styles.card, card]}>
        <Pressable accessibilityRole="switch"
          accessibilityLabel="Pin new workspaces by default"
          accessibilityState={{ checked: enabled === true, disabled }}
          aria-checked={enabled === true}
          disabled={disabled}
          onPress={() => void save(() => toggle({}), "Default saved.")}
          style={({ pressed }) => [styles.defaultRow, { opacity: pressed || disabled ? 0.65 : 1 }]}>
          <View style={styles.defaultCopy}>
            <Text style={[styles.label, foreground]}>Pin new workspaces by default</Text>
            <Text style={[styles.small, muted]}>
              {known ? enabled ? "On for projects without an override." : "Off for projects without an override." : "Loading your settings…"}
            </Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.label, foreground]}>{known ? enabled ? "On" : "Off" : "…"}</Text>
            <View style={[styles.switchTrack, { backgroundColor: enabled ? colors.accent : colors.surface2,
              borderColor: enabled ? colors.accent : colors.border, alignItems: enabled ? "flex-end" : "flex-start" }]}>
              <View style={[styles.switchThumb, { backgroundColor: enabled ? colors.accentForeground : colors.foregroundMuted }]} />
            </View>
          </View>
        </Pressable>
        <Text style={[styles.defaultHint, styles.small, muted, { borderColor: colors.border }]}>
          Projects set to Always or Never override this default.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, foreground]}>Projects</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh projects and settings"
            disabled={refreshing} onPress={() => void refresh()} style={styles.textButton}>
            <Icon name="RefreshCw" size={14} color={colors.foregroundMuted} />
            <Text style={[styles.small, muted]}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
        </View>
        <Text style={[styles.small, muted]}>
          Always pins new workspaces in that project. Never leaves them unpinned.
        </Text>
        {projects && projects.length > 0 ? (
          <TextInput accessibilityLabel="Search projects" placeholder="Search projects"
            placeholderTextColor={colors.foregroundMuted} value={query} onChangeText={setQuery}
            autoCorrect={false} autoCapitalize="none"
            style={[styles.search, foreground, card]} />
        ) : null}

        {projects === null ? (
          <Text style={[styles.empty, muted]}>{readError ? "Projects are unavailable." : "Loading projects…"}</Text>
        ) : projects.length === 0 ? (
          <View style={[styles.emptyCard, card]}>
            <Text style={[styles.label, foreground]}>Your projects will appear here</Text>
            <Text style={[styles.small, muted]}>Add a project in Paseo to give it its own auto-pin rule.</Text>
          </View>
        ) : filtered?.length === 0 ? (
          <Text style={[styles.empty, muted]}>No projects match “{query.trim()}”.</Text>
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
                    <View accessibilityRole="radiogroup" accessibilityLabel={`${project.name} auto-pin rule`}
                      style={[styles.ruleGroup, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
                      {RULES.map((option) => (
                        <Pressable key={option.value} accessibilityRole="radio"
                          accessibilityLabel={`${project.name}: ${option.label}`}
                          accessibilityState={{ checked: rule === option.value, disabled }}
                          aria-checked={rule === option.value}
                          disabled={disabled}
                          onPress={() => rule !== option.value && void save(
                            () => setRule({ projectId: project.id, rule: option.value }),
                            `${project.name}: ${option.label} saved.`,
                          )}
                          style={({ pressed }) => [styles.ruleButton, {
                            backgroundColor: rule === option.value ? colors.accent : "transparent",
                            opacity: pressed || busy ? 0.65 : 1,
                          }]}>
                          <Text style={[styles.ruleLabel, {
                            color: rule === option.value ? colors.accentForeground : colors.foregroundMuted,
                          }]}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={[styles.small, muted]}>
                      {!known ? "Loading…" : effective ? "New workspaces will be pinned" : "New workspaces will stay unpinned"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {saveError ? <Text accessibilityRole="alert" style={[styles.small, { color: colors.statusDanger }]}>{saveError}</Text> : null}
      {readError ? (
        <View style={styles.errorRow}>
          <Text accessibilityRole="alert" style={[styles.small, { color: colors.statusDanger, flex: 1 }]}>{readError}</Text>
          <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void refresh()} style={styles.textButton}>
            <Text style={[styles.label, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[styles.small, muted]}>
        {busy ? "Saving…" : feedback || "Changes save automatically."}
      </Text>

      <View style={[styles.footer, { borderColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Icon name={running ? "Check" : "CircleDashed"} size={14}
            color={readError ? colors.statusWarning : running ? colors.statusSuccess : colors.foregroundMuted} />
          <Text style={[styles.small, muted]}>
            {readError ? "Connection needs attention" : running === null ? "Connecting…" : running ? "Ready for new workspaces" : "Auto-Pin is not ready. Try reloading the plugin."}
          </Text>
        </View>
        <Text style={[styles.small, muted]}>
          Rules apply when a workspace is created. Existing pins and restored workspaces stay as they are.
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
