import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Banner, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { spacing, usePalette } from "@/theme";

function validate(nickname: string, url: string) {
  const errors: { nickname?: string; url?: string } = {};
  if (!nickname.trim()) errors.nickname = "Give it a short name, like “Kharadi 2BHK”.";
  if (!/^https?:\/\/\S+\.\S+/i.test(url.trim())) errors.url = "Paste the full link, starting with https://";
  return errors;
}

export default function AddProjectScreen() {
  const palette = usePalette();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = touched ? validate(nickname, url) : {};

  async function submit() {
    setTouched(true);
    if (Object.keys(validate(nickname, url)).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      const project = await api.createProject({ nickname: nickname.trim(), url: url.trim() });
      router.dismiss();
      router.push({ pathname: "/project/[id]", params: { id: project.id } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: palette.textMuted }]}>
          Open your state’s RERA website, search your project, and copy the link of the project details page. A builder’s
          construction-updates page works too.
        </Text>

        {serverError ? <Banner tone="error" message={serverError} /> : null}

        <Field
          label="Name"
          placeholder="Kharadi 2BHK"
          value={nickname}
          onChangeText={setNickname}
          error={errors.nickname}
          maxLength={60}
          returnKeyType="next"
        />
        <Field
          label="Project page link"
          placeholder="https://…"
          value={url}
          onChangeText={setUrl}
          error={errors.url}
          hint="The first check runs right away and takes about a minute."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <Button label="Start watching" onPress={submit} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { fontSize: 15, lineHeight: 22 },
});
