import { compareFacts, diffLines, hashLines, normalizeMarkdown, summarizeChanges } from "./changes.js";
import type { CheckResult, Snapshot } from "./db.js";
import type { ProjectFacts } from "./facts.js";

export interface PageContent {
  contentHash: string;
  lines: string[];
}

export function toPageContent(markdown: string): PageContent {
  const lines = normalizeMarkdown(markdown);
  return { contentHash: hashLines(lines), lines };
}

export function isUnchanged(previous: Snapshot, page: PageContent): boolean {
  return previous.contentHash === page.contentHash;
}

/** Decides what a check found, given the previous snapshot and the freshly scraped page. Pure — no I/O. */
export function buildCheckResult(previous: Snapshot, page: PageContent, facts: ProjectFacts | null): CheckResult {
  const base = { contentHash: page.contentHash, lines: page.lines, facts };

  if (previous.contentHash === null) {
    return {
      ...base,
      update: {
        kind: "first_snapshot",
        summary: "Started watching this page. You'll see an entry here whenever it changes.",
        factChanges: [],
        addedLines: [],
        removedLines: [],
      },
    };
  }

  if (previous.contentHash === page.contentHash) return { ...base, update: null };

  const factChanges = facts ? compareFacts(previous.facts, facts) : [];
  const diff = diffLines(previous.lines, page.lines);
  return {
    ...base,
    update: {
      kind: factChanges.length > 0 ? "facts_changed" : "page_changed",
      summary: summarizeChanges(factChanges, diff),
      factChanges,
      addedLines: diff.added,
      removedLines: diff.removed,
    },
  };
}
