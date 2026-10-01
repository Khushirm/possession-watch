import { createHash } from "node:crypto";
import { FACT_LABELS, type ProjectFacts } from "./facts.js";

/**
 * Lines that change on every visit to many government portals (visitor counters,
 * server clocks) and would otherwise trigger a false "page changed" alert daily.
 */
const VOLATILE_LINE_PATTERNS = [
  /visitor/i,
  /\bhits?\b/i,
  /page views?/i,
  /last (updated|modified|refreshed) on/i,
  /server time/i,
  /current date/i,
];

export function normalizeMarkdown(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !VOLATILE_LINE_PATTERNS.some((pattern) => pattern.test(line)));
}

export function hashLines(lines: string[]): string {
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export interface LineDiff {
  added: string[];
  removed: string[];
  /** True when the pages were too large to diff line-by-line; counts are then unknown. */
  truncated: boolean;
}

const MAX_DIFF_LINES = 3000;

/** Longest-common-subsequence line diff. Small pages only — RERA project pages are a few hundred lines. */
export function diffLines(before: string[], after: string[]): LineDiff {
  if (before.length > MAX_DIFF_LINES || after.length > MAX_DIFF_LINES) {
    return { added: [], removed: [], truncated: true };
  }

  const rows = before.length;
  const cols = after.length;
  const lcs: Uint16Array[] = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1));
  for (let i = rows - 1; i >= 0; i--) {
    const row = lcs[i]!;
    const below = lcs[i + 1]!;
    for (let j = cols - 1; j >= 0; j--) {
      row[j] = before[i] === after[j] ? below[j + 1]! + 1 : Math.max(below[j]!, row[j + 1]!);
    }
  }

  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      removed.push(before[i++]!);
    } else {
      added.push(after[j++]!);
    }
  }
  while (i < rows) removed.push(before[i++]!);
  while (j < cols) added.push(after[j++]!);

  return { added, removed, truncated: false };
}

export interface FactChange {
  field: keyof ProjectFacts;
  label: string;
  before: string | number | null;
  after: string | number | null;
}

export function compareFacts(before: ProjectFacts | null, after: ProjectFacts): FactChange[] {
  if (!before) return [];
  return (Object.keys(FACT_LABELS) as (keyof ProjectFacts)[])
    .filter((field) => before[field] !== after[field])
    .map((field) => ({ field, label: FACT_LABELS[field], before: before[field], after: after[field] }));
}

function formatValue(value: string | number | null): string {
  return value === null ? "not listed" : String(value);
}

export function summarizeChanges(factChanges: FactChange[], diff: LineDiff): string {
  if (factChanges.length > 0) {
    return factChanges.map((change) => `${change.label}: ${formatValue(change.before)} → ${formatValue(change.after)}`).join("\n");
  }
  if (diff.truncated) return "The project page changed. Open the page to review it.";
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} line${diff.added.length === 1 ? "" : "s"} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} line${diff.removed.length === 1 ? "" : "s"} removed`);
  return `Page text changed (${parts.join(", ")}). Key facts are unchanged.`;
}
