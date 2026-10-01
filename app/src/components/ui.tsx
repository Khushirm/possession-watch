import DateTimePicker from "@react-native-community/datetimepicker";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { CheckStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { radius, spacing, usePalette } from "@/theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>{children}</View>;
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", loading = false, disabled = false }: ButtonProps) {
  const palette = usePalette();
  const colors = {
    primary: { bg: palette.primary, fg: palette.primaryText, border: palette.primary },
    secondary: { bg: "transparent", fg: palette.text, border: palette.border },
    danger: { bg: "transparent", fg: palette.danger, border: palette.danger },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={colors.fg} /> : <Text style={[styles.buttonLabel, { color: colors.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const STATUS_COPY: Record<CheckStatus, string> = { pending: "Checking…", ok: "Watching", error: "Check failed" };

export function StatusBadge({ status }: { status: CheckStatus }) {
  const palette = usePalette();
  const tone = {
    pending: { bg: palette.warningBg, fg: palette.warning },
    ok: { bg: palette.successBg, fg: palette.success },
    error: { bg: palette.dangerBg, fg: palette.danger },
  }[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeLabel, { color: tone.fg }]}>{STATUS_COPY[status]}</Text>
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, style, ...inputProps }: FieldProps) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.surface, borderColor: error ? palette.danger : palette.border },
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={[styles.fieldHint, { color: palette.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, { color: palette.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  hint?: string;
}

export function DateField({ label, value, onChange, hint }: DateFieldProps) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}. Tap to change.`}
        onPress={() => setOpen((current) => !current)}
        style={[styles.input, styles.dateInput, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <Text style={{ color: palette.text, fontSize: 16 }}>{formatDate(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onValueChange={(_event, date) => {
            if (Platform.OS !== "ios") setOpen(false);
            onChange(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
      {hint ? <Text style={[styles.fieldHint, { color: palette.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Banner({ tone, message }: { tone: "error" | "info"; message: string }) {
  const palette = usePalette();
  const colors = tone === "error" ? { bg: palette.dangerBg, fg: palette.danger } : { bg: palette.warningBg, fg: palette.warning };
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.fg, fontSize: 14, lineHeight: 20 }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeLabel: { fontSize: 12, fontWeight: "600" },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  fieldHint: { fontSize: 13, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  dateInput: { justifyContent: "center" },
  banner: { borderRadius: radius.md, padding: spacing.md },
});
