import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Card, StatusBadge } from "@/components/ui";
import { api, type Project, type ProjectFacts, type ProjectUpdate } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { spacing, usePalette } from "@/theme";

const POLL_WHILE_PENDING_MS = 5_000;

const FACT_ROWS: { key: keyof ProjectFacts; label: string; suffix?: string }[] = [
  { key: "projectName", label: "Project" },
  { key: "promoterName", label: "Promoter" },
  { key: "reraRegistrationNumber", label: "RERA number" },
  { key: "projectStatus", label: "Status" },
  { key: "proposedCompletionDate", label: "Proposed completion" },
  { key: "revisedCompletionDate", label: "Revised completion" },
  { key: "extensionCount", label: "Extensions" },
  { key: "complaintCount", label: "Complaints" },
  { key: "constructionProgressPercent", label: "Progress", suffix: "%" },
];

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const body = await api.getProject(id);
      setProject(body.project);
      setUpdates(body.updates);
      setError(null);
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 404) setNotFound(true);
      setError(err instanceof Error ? err.message : "Couldn't load this project.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pending = project?.checkStatus === "pending";
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void load(), POLL_WHILE_PENDING_MS);
    return () => clearInterval(timer);
  }, [pending, load]);

  async function checkNow() {
    setChecking(true);
    try {
      setProject(await api.checkNow(id));
    } catch (err) {
      Alert.alert("Can't check right now", err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setChecking(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Stop watching?", "This removes the project and its update history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop watching",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteProject(id);
            router.back();
          } catch (err) {
            Alert.alert("Couldn't remove project", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  if (!project) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        {error ? <Banner tone="error" message={notFound ? "This project no longer exists." : error} /> : <ActivityIndicator color={palette.primary} />}
      </View>
    );
  }

  const facts = project.facts;

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={palette.primary}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Stack.Screen options={{ title: project.nickname }} />

      {error ? <Banner tone="error" message={error} /> : null}
      {project.checkStatus === "error" && project.lastError ? <Banner tone="error" message={project.lastError} /> : null}

      <Card>
        <View style={styles.row}>
          <StatusBadge status={project.checkStatus} />
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {project.lastCheckedAt ? `Last checked ${formatRelative(project.lastCheckedAt)}` : "First check in progress"}
          </Text>
        </View>
        <Text style={[styles.link, { color: palette.primary }]} numberOfLines={2} onPress={() => Linking.openURL(project.url)} accessibilityRole="link">
          {project.url}
        </Text>
        <Text style={[styles.meta, { color: palette.textMuted }]}>Checked automatically every morning at 7:00 IST.</Text>
      </Card>

      <Card>
        <Text style={[styles.heading, { color: palette.text }]}>Key facts</Text>
        {facts ? (
          FACT_ROWS.map(({ key, label, suffix }) => (
            <View key={key} style={styles.factRow}>
              <Text style={[styles.factLabel, { color: palette.textMuted }]}>{label}</Text>
              <Text style={[styles.factValue, { color: palette.text }]}>
                {facts[key] === null ? "—" : `${facts[key]}${suffix ?? ""}`}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.body, { color: palette.textMuted }]}>
            {pending ? "Reading the page…" : "We couldn't find structured facts on this page. We'll still alert you when it changes."}
          </Text>
        )}
        <Text style={[styles.meta, { color: palette.textMuted }]}>
          Extracted automatically from the page. Always confirm on the official portal.
        </Text>
      </Card>

      <Text style={[styles.heading, { color: palette.text }]}>Updates</Text>
      {updates.length === 0 ? (
        <Text style={[styles.body, { color: palette.textMuted }]}>No changes recorded yet.</Text>
      ) : (
        updates.map((update) => <UpdateCard key={update.id} update={update} />)
      )}

      <View style={styles.actions}>
        <Button label="Check now" variant="secondary" onPress={checkNow} loading={checking} disabled={pending} />
        <Button label="Stop watching" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function UpdateCard({ update }: { update: ProjectUpdate }) {
  const palette = usePalette();
  const [expanded, setExpanded] = useState(false);
  const hasDiff = update.addedLines.length + update.removedLines.length > 0;
  const title = { first_snapshot: "Started watching", facts_changed: "Key facts changed", page_changed: "Page updated" }[update.kind];

  return (
    <Card style={update.kind === "facts_changed" ? { borderColor: palette.warning, borderWidth: 1 } : undefined}>
      <View style={styles.row}>
        <Text style={[styles.updateTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.meta, { color: palette.textMuted }]}>{formatDate(update.detectedAt)}</Text>
      </View>
      <Text style={[styles.body, { color: palette.text }]}>{update.summary}</Text>
      {hasDiff ? (
        <Text style={[styles.link, { color: palette.primary }]} accessibilityRole="button" onPress={() => setExpanded((value) => !value)}>
          {expanded ? "Hide changed lines" : "Show changed lines"}
        </Text>
      ) : null}
      {expanded ? (
        <View style={styles.diff}>
          {update.removedLines.map((line, index) => (
            <Text key={`r${index}`} style={[styles.diffLine, { color: palette.removed }]}>
              − {line}
            </Text>
          ))}
          {update.addedLines.map((line, index) => (
            <Text key={`a${index}`} style={[styles.diffLine, { color: palette.added }]}>
              + {line}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heading: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13 },
  link: { fontSize: 14, fontWeight: "600" },
  factRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 2 },
  factLabel: { fontSize: 14 },
  factValue: { fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  updateTitle: { fontSize: 16, fontWeight: "700" },
  diff: { gap: 2 },
  diffLine: { fontSize: 13, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
