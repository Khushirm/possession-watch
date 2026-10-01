import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Card, StatusBadge } from "@/components/ui";
import { api, type Project } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { spacing, usePalette } from "@/theme";

const POLL_WHILE_PENDING_MS = 5_000;

export default function ProjectsScreen() {
  const palette = usePalette();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await api.listProjects();
      if (!mounted.current) return;
      setProjects(next);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Couldn't load projects.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const hasPending = projects?.some((project) => project.checkStatus === "pending") ?? false;
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void load(), POLL_WHILE_PENDING_MS);
    return () => clearInterval(timer);
  }, [hasPending, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/add-project" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Watch a new project" hitSlop={12} style={styles.headerButton}>
                <Ionicons name="add-circle-outline" size={28} color={palette.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />

      {projects === null && !error ? (
        <ActivityIndicator style={styles.loader} color={palette.primary} />
      ) : (
        <FlatList
          data={projects ?? []}
          keyExtractor={(project) => project.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
          ListHeaderComponent={error ? <Banner tone="error" message={error} /> : null}
          ListEmptyComponent={
            error ? null : (
              <Card>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>Waiting on an under-construction flat?</Text>
                <Text style={[styles.body, { color: palette.textMuted }]}>
                  Paste the public RERA page of your project. We check it every morning and tell you when the builder
                  files an extension, changes the completion date, or new complaints appear.
                </Text>
                <Button label="Watch my project" onPress={() => router.push("/add-project")} />
              </Card>
            )
          }
          renderItem={({ item }) => <ProjectRow project={item} />}
        />
      )}
    </View>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const palette = usePalette();
  const completion = project.facts?.revisedCompletionDate ?? project.facts?.proposedCompletionDate;

  return (
    <Link href={{ pathname: "/project/[id]", params: { id: project.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${project.nickname}`}>
        {({ pressed }) => (
          <Card style={{ opacity: pressed ? 0.85 : 1 }}>
            <View style={styles.rowHeader}>
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                {project.nickname}
              </Text>
              <StatusBadge status={project.checkStatus} />
            </View>
            {project.facts?.projectName ? (
              <Text style={[styles.body, { color: palette.textMuted }]} numberOfLines={1}>
                {project.facts.projectName}
                {project.facts.promoterName ? ` · ${project.facts.promoterName}` : ""}
              </Text>
            ) : null}
            <Text style={[styles.meta, { color: palette.textMuted }]}>
              {completion ? `Completion: ${completion} · ` : ""}
              {project.updateCount} update{project.updateCount === 1 ? "" : "s"}
              {project.lastCheckedAt ? ` · checked ${formatRelative(project.lastCheckedAt)}` : ""}
            </Text>
          </Card>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.md },
  headerButton: { paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  rowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rowTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
  meta: { fontSize: 13 },
});
