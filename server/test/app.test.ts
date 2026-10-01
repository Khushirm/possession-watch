import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, MANUAL_CHECK_COOLDOWN_MS, MAX_PROJECTS } from "../src/app.js";
import { buildCheckResult, toPageContent } from "../src/check.js";
import { Store } from "../src/db.js";

const url = "https://rera.example.gov.in/project/123";

describe("API", () => {
  let store: Store;
  let requestCheck: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
  let clock: number;

  function makeApp(apiToken?: string) {
    return createApp({ store, requestCheck, apiToken, now: () => clock });
  }

  function post(app: ReturnType<typeof makeApp>, path: string, body?: unknown, headers: Record<string, string> = {}) {
    return app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    store = await Store.open({ url: ":memory:" });
    requestCheck = vi.fn(async () => {});
    clock = Date.now();
  });

  afterEach(() => store.close());

  it("creates a project and queues its first check", async () => {
    const res = await post(makeApp(), "/projects", { nickname: "My flat", url });
    expect(res.status).toBe(201);
    const { project } = (await res.json()) as { project: { id: string; checkStatus: string } };
    expect(project.checkStatus).toBe("pending");
    expect(requestCheck).toHaveBeenCalledWith(project.id);
  });

  it("rejects invalid and non-http URLs", async () => {
    const app = makeApp();
    expect((await post(app, "/projects", { nickname: "x", url: "not a url" })).status).toBe(400);
    expect((await post(app, "/projects", { nickname: "x", url: "file:///etc/passwd" })).status).toBe(400);
    expect((await post(app, "/projects", { url })).status).toBe(400);
  });

  it("rejects duplicates and enforces the project cap", async () => {
    const app = makeApp();
    await post(app, "/projects", { nickname: "a", url });
    expect((await post(app, "/projects", { nickname: "b", url })).status).toBe(409);

    for (let i = 1; i < MAX_PROJECTS; i++) {
      await post(app, "/projects", { nickname: `p${i}`, url: `${url}?n=${i}` });
    }
    expect((await post(app, "/projects", { nickname: "one too many", url: `${url}?n=999` })).status).toBe(422);
  });

  it("returns a project with its update history", async () => {
    const project = await store.createProject({ nickname: "My flat", url });
    await store.recordCheck(project.id, buildCheckResult((await store.getSnapshot(project.id))!, toPageContent("Status: Ongoing"), null));

    const res = await makeApp().request(`/projects/${project.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { project: { checkStatus: string }; updates: { kind: string }[] };
    expect(body.project.checkStatus).toBe("ok");
    expect(body.updates.map((update) => update.kind)).toEqual(["first_snapshot"]);
  });

  it("rate-limits manual checks", async () => {
    const app = makeApp();
    const project = await store.createProject({ nickname: "My flat", url });
    await store.recordCheck(project.id, buildCheckResult((await store.getSnapshot(project.id))!, toPageContent("x"), null));

    const tooSoon = await post(app, `/projects/${project.id}/check`);
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.headers.get("retry-after")).not.toBeNull();

    clock += MANUAL_CHECK_COOLDOWN_MS + 1000;
    expect((await post(app, `/projects/${project.id}/check`)).status).toBe(202);
    expect(requestCheck).toHaveBeenCalledTimes(1);
  });

  it("deletes a project and its updates", async () => {
    const app = makeApp();
    const project = await store.createProject({ nickname: "My flat", url });
    await store.recordCheck(project.id, buildCheckResult((await store.getSnapshot(project.id))!, toPageContent("x"), null));
    expect(await store.listUpdates(project.id)).toHaveLength(1);

    expect((await app.request(`/projects/${project.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await app.request(`/projects/${project.id}`)).status).toBe(404);
    expect(await store.listUpdates(project.id)).toHaveLength(0);
  });

  it("requires the bearer token when one is configured", async () => {
    const app = makeApp("s3cret-token");
    expect((await app.request("/projects")).status).toBe(401);
    expect((await app.request("/projects", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    expect((await app.request("/projects", { headers: { authorization: "Bearer s3cret-token" } })).status).toBe(200);
    expect((await app.request("/health")).status).toBe(200);
  });
});
