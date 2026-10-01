import Firecrawl, { SdkError } from "@mendable/firecrawl-js";
import { NonRetriableError } from "inngest";
import {
  FACTS_EXTRACTION_PROMPT,
  projectFactsJsonSchema,
  projectFactsSchema,
  type ProjectFacts,
} from "./facts.js";

/** Abstraction over Firecrawl so the check pipeline can be tested without network calls or credits. */
export interface PageScraper {
  /** Cheap call (≈1 credit): page as markdown. */
  fetchMarkdown(url: string): Promise<string>;
  /** Expensive call (≈5 credits): structured facts. Only made when the page actually changed. */
  extractFacts(url: string): Promise<ProjectFacts | null>;
}

const SCRAPE_TIMEOUT_MS = 60_000;

/**
 * Retrying cannot fix a bad key (401), an exhausted free quota (402) or a blocked URL (403),
 * and every retry would burn time — fail the run immediately with a readable message.
 */
async function withPermanentFailures<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof SdkError) {
      if (error.status === 401) throw new NonRetriableError("Firecrawl rejected the API key. Check FIRECRAWL_API_KEY.");
      if (error.status === 402) throw new NonRetriableError("Firecrawl free credits are used up for this month.");
      if (error.status === 403) throw new NonRetriableError("Firecrawl is not allowed to read this website.");
    }
    throw error;
  }
}

export function createFirecrawlScraper(apiKey: string): PageScraper {
  const client = new Firecrawl({ apiKey });

  return {
    async fetchMarkdown(url) {
      const document = await withPermanentFailures(() => client.scrape(url, {
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 0,
        timeout: SCRAPE_TIMEOUT_MS,
      }));
      if (!document.markdown) throw new Error("Firecrawl returned no content for this page.");
      return document.markdown;
    },

    async extractFacts(url) {
      const document = await withPermanentFailures(() => client.scrape(url, {
        formats: [{ type: "json", schema: projectFactsJsonSchema, prompt: FACTS_EXTRACTION_PROMPT }],
        onlyMainContent: true,
        // The markdown fetch moments ago already got a fresh copy; allow reuse of that.
        maxAge: 10 * 60_000,
        timeout: SCRAPE_TIMEOUT_MS,
      }));
      const parsed = projectFactsSchema.safeParse(document.json);
      return parsed.success ? parsed.data : null;
    },
  };
}
