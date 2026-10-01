import { describe, expect, it } from "vitest";
import { buildCheckResult, toPageContent } from "../src/check.js";
import { compareFacts, diffLines, normalizeMarkdown, summarizeChanges } from "../src/changes.js";
import type { ProjectFacts } from "../src/facts.js";

const baseFacts: ProjectFacts = {
  projectName: "Green Heights",
  promoterName: "ABC Developers",
  reraRegistrationNumber: "P52100012345",
  projectStatus: "Ongoing",
  proposedCompletionDate: "2025-12-31",
  revisedCompletionDate: null,
  extensionCount: 0,
  complaintCount: 2,
  constructionProgressPercent: 60,
};

describe("normalizeMarkdown", () => {
  it("drops blank and volatile lines and collapses whitespace", () => {
    const lines = normalizeMarkdown("# Project\n\n  Tower   A  \nVisitor Count: 10234\nLast updated on 01-10-2026\n");
    expect(lines).toEqual(["# Project", "Tower A"]);
  });

  it("produces the same hash when only volatile lines differ", () => {
    const a = toPageContent("Status: Ongoing\nVisitors: 100");
    const b = toPageContent("Status: Ongoing\nVisitors: 101");
    expect(a.contentHash).toBe(b.contentHash);
  });
});

describe("diffLines", () => {
  it("reports added and removed lines", () => {
    expect(diffLines(["a", "b", "c"], ["a", "c", "d"])).toEqual({ added: ["d"], removed: ["b"], truncated: false });
  });

  it("gives up gracefully on very large pages", () => {
    const big = Array.from({ length: 3001 }, (_, i) => `line ${i}`);
    expect(diffLines(big, ["x"]).truncated).toBe(true);
  });
});

describe("compareFacts", () => {
  it("lists only fields that changed", () => {
    const changes = compareFacts(baseFacts, { ...baseFacts, revisedCompletionDate: "2026-12-31", extensionCount: 1 });
    expect(changes.map((change) => change.field)).toEqual(["revisedCompletionDate", "extensionCount"]);
    expect(summarizeChanges(changes, { added: [], removed: [], truncated: false })).toBe(
      "Revised completion: not listed → 2026-12-31\nExtensions granted: 0 → 1",
    );
  });

  it("returns nothing when there is no previous snapshot", () => {
    expect(compareFacts(null, baseFacts)).toEqual([]);
  });
});

describe("buildCheckResult", () => {
  const emptySnapshot = { contentHash: null, lines: [], facts: null };

  it("records a first snapshot", () => {
    const result = buildCheckResult(emptySnapshot, toPageContent("Status: Ongoing"), baseFacts);
    expect(result.update?.kind).toBe("first_snapshot");
    expect(result.facts).toEqual(baseFacts);
  });

  it("records nothing when the page is unchanged", () => {
    const page = toPageContent("Status: Ongoing");
    const result = buildCheckResult({ contentHash: page.contentHash, lines: page.lines, facts: baseFacts }, page, null);
    expect(result.update).toBeNull();
  });

  it("flags a fact change above a plain text change", () => {
    const before = toPageContent("Completion: 2025-12-31");
    const after = toPageContent("Completion: 2026-12-31");
    const result = buildCheckResult(
      { contentHash: before.contentHash, lines: before.lines, facts: baseFacts },
      after,
      { ...baseFacts, revisedCompletionDate: "2026-12-31" },
    );
    expect(result.update?.kind).toBe("facts_changed");
    expect(result.update?.summary).toContain("Revised completion");
    expect(result.update?.addedLines).toEqual(["Completion: 2026-12-31"]);
  });

  it("reports a text-only change when facts are the same", () => {
    const before = toPageContent("Quarterly report Q1");
    const after = toPageContent("Quarterly report Q1\nQuarterly report Q2");
    const result = buildCheckResult({ contentHash: before.contentHash, lines: before.lines, facts: baseFacts }, after, baseFacts);
    expect(result.update?.kind).toBe("page_changed");
    expect(result.update?.summary).toBe("Page text changed (1 line added). Key facts are unchanged.");
  });
});
