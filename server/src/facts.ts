import { z } from "zod";

/**
 * The handful of facts a home buyer actually cares about on a RERA project page.
 * Every field is nullable: portals differ, and a missing value must never be invented.
 */
export const projectFactsSchema = z.object({
  projectName: z.string().nullable(),
  promoterName: z.string().nullable(),
  reraRegistrationNumber: z.string().nullable(),
  projectStatus: z.string().nullable(),
  proposedCompletionDate: z.string().nullable(),
  revisedCompletionDate: z.string().nullable(),
  extensionCount: z.number().int().nonnegative().nullable(),
  complaintCount: z.number().int().nonnegative().nullable(),
  constructionProgressPercent: z.number().min(0).max(100).nullable(),
});

export type ProjectFacts = z.infer<typeof projectFactsSchema>;

export const FACT_LABELS: Record<keyof ProjectFacts, string> = {
  projectName: "Project name",
  promoterName: "Promoter",
  reraRegistrationNumber: "RERA number",
  projectStatus: "Status",
  proposedCompletionDate: "Proposed completion",
  revisedCompletionDate: "Revised completion",
  extensionCount: "Extensions granted",
  complaintCount: "Complaints filed",
  constructionProgressPercent: "Construction progress (%)",
};

/** JSON Schema sent to Firecrawl's JSON extraction format. Kept explicit so the request is stable across SDK versions. */
export const projectFactsJsonSchema = {
  type: "object",
  properties: {
    projectName: { type: ["string", "null"] },
    promoterName: { type: ["string", "null"], description: "Builder / developer / promoter company name" },
    reraRegistrationNumber: { type: ["string", "null"] },
    projectStatus: { type: ["string", "null"], description: "e.g. Ongoing, Completed, Lapsed, Revoked" },
    proposedCompletionDate: { type: ["string", "null"], description: "Original proposed completion date, ISO YYYY-MM-DD if possible" },
    revisedCompletionDate: { type: ["string", "null"], description: "Latest revised or extended completion date, ISO YYYY-MM-DD if possible" },
    extensionCount: { type: ["integer", "null"], description: "Number of registration extensions granted" },
    complaintCount: { type: ["integer", "null"], description: "Number of complaints listed against the project" },
    constructionProgressPercent: { type: ["number", "null"], description: "Overall construction progress percentage 0-100" },
  },
  required: Object.keys(FACT_LABELS),
} as const;

export const FACTS_EXTRACTION_PROMPT =
  "Extract facts about this real-estate project from the page. Use null for anything not explicitly stated on the page. Do not guess.";
