import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, DateField, Field } from "@/components/ui";
import { calculateDelayInterest } from "@/lib/delay";
import { formatDate, formatRupees, parseAmount } from "@/lib/format";
import { spacing, usePalette } from "@/theme";

/** A starting point only: state RERA rules typically use SBI's highest MCLR + 2%. Users should confirm today's rate. */
const DEFAULT_RATE_PERCENT = "11";

export default function CalculatorScreen() {
  const palette = usePalette();
  const [amountText, setAmountText] = useState("");
  const [promisedDate, setPromisedDate] = useState(() => new Date(new Date().getFullYear() - 1, 0, 1));
  const [graceText, setGraceText] = useState("0");
  const [rateText, setRateText] = useState(DEFAULT_RATE_PERCENT);
  const [asOf, setAsOf] = useState(() => new Date());

  const amount = parseAmount(amountText);
  const graceMonths = Number(graceText || "0");
  const rate = Number(rateText);

  const amountError = amountText && (!Number.isFinite(amount) || amount <= 0) ? "Enter the amount in rupees, e.g. 45,00,000" : undefined;
  const graceError = !Number.isInteger(graceMonths) || graceMonths < 0 || graceMonths > 24 ? "Enter whole months between 0 and 24" : undefined;
  const rateError = !Number.isFinite(rate) || rate <= 0 || rate > 30 ? "Enter a yearly rate between 0 and 30" : undefined;

  const result = useMemo(() => {
    if (!amountText || amountError || graceError || rateError) return null;
    return calculateDelayInterest({ amountPaid: amount, promisedDate, graceMonths, annualRatePercent: rate, asOf });
  }, [amountText, amountError, graceError, rateError, amount, promisedDate, graceMonths, rate, asOf]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: palette.textMuted }]}>
          If your builder misses the possession date, Section 18 of the RERA Act lets you claim interest for every month of
          delay. Estimate what you’re owed.
        </Text>

        <Field
          label="Amount paid to builder (₹)"
          placeholder="45,00,000"
          keyboardType="number-pad"
          value={amountText}
          onChangeText={setAmountText}
          error={amountError}
        />
        <DateField label="Promised possession date" value={promisedDate} onChange={setPromisedDate} hint="As written in your builder-buyer agreement." />
        <Field label="Grace period (months)" keyboardType="number-pad" value={graceText} onChangeText={setGraceText} error={graceError} hint="Check your agreement — often 0 or 6." />
        <Field
          label="Interest rate (% per year)"
          keyboardType="decimal-pad"
          value={rateText}
          onChangeText={setRateText}
          error={rateError}
          hint="Most states use SBI's highest MCLR + 2%. Check SBI's current MCLR and adjust."
        />
        <DateField label="Calculate up to" value={asOf} onChange={setAsOf} hint="Today, or the date you actually got possession." />

        {result ? (
          <Card style={{ borderColor: palette.primary, borderWidth: 1 }}>
            {result.delayDays === 0 ? (
              <Text style={[styles.body, { color: palette.text }]}>
                No delay yet. Interest starts after {formatDate(result.delayStartsOn)}.
              </Text>
            ) : (
              <>
                <Text style={[styles.label, { color: palette.textMuted }]}>Estimated interest owed</Text>
                <Text style={[styles.total, { color: palette.primary }]} accessibilityLiveRegion="polite">
                  {formatRupees(result.interestOwed)}
                </Text>
                <View style={styles.row}>
                  <Text style={[styles.body, { color: palette.textMuted }]}>Delay</Text>
                  <Text style={[styles.body, { color: palette.text }]}>
                    {result.delayDays} days (since {formatDate(result.delayStartsOn)})
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={[styles.body, { color: palette.textMuted }]}>Adds up per month</Text>
                  <Text style={[styles.body, { color: palette.text }]}>{formatRupees(result.interestPerMonth)}</Text>
                </View>
              </>
            )}
          </Card>
        ) : null}

        <Text style={[styles.disclaimer, { color: palette.textMuted }]}>
          An estimate for awareness, not legal advice. The final amount depends on your state’s RERA rules, your agreement and
          the authority’s order.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { fontSize: 15, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  total: { fontSize: 34, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  disclaimer: { fontSize: 13, lineHeight: 19 },
});
