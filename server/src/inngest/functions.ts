import { cron, NonRetriableError } from "inngest";
import { buildCheckResult, isUnchanged, toPageContent } from "../check.js";
import type { Store } from "../db.js";
import type { PageScraper } from "../scraper.js";
import { inngest, projectCheckRequested } from "./client.js";

interface Deps {
  store: Store;
  scraper: PageScraper;
}

export function createFunctions({ store, scraper }: Deps) {
  const checkProject = inngest.createFunction(
    {
      id: "check-project",
      triggers: [projectCheckRequested],
      // Firecrawl's free plan allows 2 concurrent requests.
      concurrency: { limit: 2 },
      // Duplicate "check now" taps are already rejected by the API (pending + cooldown guard).
      retries: 3,
      onFailure: async ({ event, error }) => {
        const projectId = (event.data.event.data as { projectId?: string }).projectId;
        if (projectId) await store.markCheckFailed(projectId, error.message);
      },
    },
    async ({ event, step }) => {
      const { projectId } = event.data;

      const project = await step.run("load-project", () => store.getProject(projectId));
      if (!project) throw new NonRetriableError(`Project ${projectId} no longer exists.`);

      const page = await step.run("fetch-page", async () => toPageContent(await scraper.fetchMarkdown(project.url)));
      const previous = await step.run("load-snapshot", () => store.getSnapshot(projectId));
      if (!previous) throw new NonRetriableError(`Project ${projectId} no longer exists.`);

      if (isUnchanged(previous, page)) {
        await step.run("record-unchanged", () => store.recordCheck(projectId, buildCheckResult(previous, page, null)));
        return { changed: false };
      }

      // Only spend extraction credits when the page actually changed.
      const facts = await step.run("extract-facts", () => scraper.extractFacts(project.url));
      const result = buildCheckResult(previous, page, facts);
      await step.run("record-change", () => store.recordCheck(projectId, result));
      return { changed: true, kind: result.update?.kind };
    },
  );

  const checkAllProjectsDaily = inngest.createFunction(
    { id: "check-all-projects-daily", triggers: [cron("TZ=Asia/Kolkata 0 7 * * *")] },
    async ({ step }) => {
      const projectIds = await step.run("list-projects", () => store.listProjectIds());
      if (projectIds.length === 0) return { queued: 0 };
      await step.sendEvent(
        "fan-out-checks",
        projectIds.map((projectId) => projectCheckRequested.create({ projectId })),
      );
      return { queued: projectIds.length };
    },
  );

  return [checkProject, checkAllProjectsDaily];
}
