import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1).default("file:./data/possession-watch.db"),
    DATABASE_AUTH_TOKEN: optionalString,
    FIRECRAWL_API_KEY: z.string().min(1, "FIRECRAWL_API_KEY is required — get a free key at https://www.firecrawl.dev"),
    APP_API_TOKEN: optionalString,
    /** Public https origin of this server, reported to Inngest Cloud. Falls back to Render's RENDER_EXTERNAL_URL. */
    PUBLIC_URL: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.APP_API_TOKEN) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_API_TOKEN"],
        message: "is required in production — anyone who finds the URL could otherwise spend your Firecrawl credits",
      });
    }
    if (/^(libsql|https?|wss?):/.test(env.DATABASE_URL) && !env.DATABASE_AUTH_TOKEN) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_AUTH_TOKEN"], message: "is required for a remote database" });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse({ ...source, PUBLIC_URL: source.PUBLIC_URL || source.RENDER_EXTERNAL_URL });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  return parsed.data;
}
