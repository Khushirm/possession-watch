import { eventType, Inngest } from "inngest";
import { z } from "zod";

// Dev vs cloud mode comes from the environment: INNGEST_DEV=1 locally,
// INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY in production.
export const inngest = new Inngest({ id: "possession-watch" });

export const projectCheckRequested = eventType("project/check.requested", {
  schema: z.object({ projectId: z.string().uuid() }),
});
