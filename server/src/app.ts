import { timingSafeEqual } from "node:crypto";
import { Hono, type Handler, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { z } from "zod";
import type { Store } from "./db.js";

/** Protects the free Firecrawl quota: daily checks of this many pages fit comfortably in 1,000 credits/month. */
export const MAX_PROJECTS = 10;
/** Minimum gap between manual "check now" requests for one project. */
export const MANUAL_CHECK_COOLDOWN_MS = 15 * 60_000;

export interface AppDeps {
  store: Store;
  requestCheck: (projectId: string) => Promise<void>;
  apiToken?: string;
  /** Mounted at /api/inngest. Omitted in tests. */
  inngestHandler?: Handler;
  now?: () => number;
}

const createProjectSchema = z.object({
  nickname: z.string().trim().min(1, "Give the project a short name.").max(60),
  url: z
    .string()
    .trim()
    .max(2000)
    .pipe(z.url({ protocol: /^https?$/, error: "Enter a full web address starting with https://" })),
});

function bearerAuth(token: string): MiddlewareHandler {
  const expected = Buffer.from(token);
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const supplied = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new HTTPException(401, { message: "Missing or invalid API token." });
    }
    await next();
  };
}

export function createApp({ store, requestCheck, apiToken, inngestHandler, now = Date.now }: AppDeps) {
  const app = new Hono();

  app.use("*", logger());
  app.use("/projects/*", cors());
  app.use("/projects", cors());
  if (apiToken) {
    app.use("/projects", bearerAuth(apiToken));
    app.use("/projects/*", bearerAuth(apiToken));
  }

  app.get("/health", (c) => c.json({ status: "ok" }));

  if (inngestHandler) app.on(["GET", "POST", "PUT"], "/api/inngest", inngestHandler);

  app.get("/projects", async (c) => c.json({ projects: await store.listProjects() }));

  app.post("/projects", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
    }
    if (await store.findProjectByUrl(parsed.data.url)) {
      return c.json({ error: "You're already watching this page." }, 409);
    }
    if ((await store.countProjects()) >= MAX_PROJECTS) {
      return c.json({ error: `You can watch up to ${MAX_PROJECTS} projects on the free plan.` }, 422);
    }

    const project = await store.createProject(parsed.data);
    await requestCheck(project.id);
    return c.json({ project }, 201);
  });

  app.get("/projects/:id", async (c) => {
    const project = await store.getProject(c.req.param("id"));
    if (!project) return c.json({ error: "Project not found." }, 404);
    return c.json({ project, updates: await store.listUpdates(project.id) });
  });

  app.post("/projects/:id/check", async (c) => {
    const project = await store.getProject(c.req.param("id"));
    if (!project) return c.json({ error: "Project not found." }, 404);
    if (project.checkStatus === "pending") return c.json({ project }, 202);

    const lastChecked = project.lastCheckedAt ? Date.parse(project.lastCheckedAt) : 0;
    const waitMs = lastChecked + MANUAL_CHECK_COOLDOWN_MS - now();
    if (waitMs > 0) {
      const minutes = Math.ceil(waitMs / 60_000);
      c.header("Retry-After", String(Math.ceil(waitMs / 1000)));
      return c.json({ error: `Checked recently. Try again in ${minutes} min.` }, 429);
    }

    await store.markCheckPending(project.id);
    await requestCheck(project.id);
    return c.json({ project: await store.getProject(project.id) }, 202);
  });

  app.delete("/projects/:id", async (c) => {
    if (!(await store.deleteProject(c.req.param("id")))) return c.json({ error: "Project not found." }, 404);
    return c.body(null, 204);
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Something went wrong on the server." }, 500);
  });

  return app;
}
