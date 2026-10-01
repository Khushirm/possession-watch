import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

const base = { FIRECRAWL_API_KEY: "fc-test" };

describe("loadEnv", () => {
  it("defaults to a local SQLite file", () => {
    expect(loadEnv(base).DATABASE_URL).toBe("file:./data/possession-watch.db");
  });

  it("requires an API token in production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow(/APP_API_TOKEN/);
    expect(loadEnv({ ...base, NODE_ENV: "production", APP_API_TOKEN: "t" }).APP_API_TOKEN).toBe("t");
  });

  it("requires an auth token for a remote database", () => {
    const remote = { ...base, DATABASE_URL: "libsql://watch-me.turso.io" };
    expect(() => loadEnv(remote)).toThrow(/DATABASE_AUTH_TOKEN/);
    expect(loadEnv({ ...remote, DATABASE_AUTH_TOKEN: "x" }).DATABASE_AUTH_TOKEN).toBe("x");
  });

  it("uses Render's external URL as the public URL", () => {
    expect(loadEnv({ ...base, RENDER_EXTERNAL_URL: "https://pw.onrender.com" }).PUBLIC_URL).toBe("https://pw.onrender.com");
    expect(loadEnv({ ...base, PUBLIC_URL: "https://x.dev", RENDER_EXTERNAL_URL: "https://pw.onrender.com" }).PUBLIC_URL).toBe("https://x.dev");
  });
});
