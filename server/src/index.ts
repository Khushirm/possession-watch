import { serve as serveNode } from "@hono/node-server";
import { serve as serveInngest } from "inngest/hono";
import { createApp } from "./app.js";
import { Store } from "./db.js";
import { loadEnv } from "./env.js";
import { inngest, projectCheckRequested } from "./inngest/client.js";
import { createFunctions } from "./inngest/functions.js";
import { createFirecrawlScraper } from "./scraper.js";

const env = loadEnv();
const store = await Store.open({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
const scraper = createFirecrawlScraper(env.FIRECRAWL_API_KEY);

const app = createApp({
  store,
  apiToken: env.APP_API_TOKEN,
  requestCheck: async (projectId) => {
    await inngest.send(projectCheckRequested.create({ projectId }));
  },
  inngestHandler: serveInngest({
    client: inngest,
    functions: createFunctions({ store, scraper }),
    serveOrigin: env.PUBLIC_URL,
  }),
});

const server = serveNode({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" }, (info) => {
  console.log(`Possession Watch API listening on http://localhost:${info.port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
