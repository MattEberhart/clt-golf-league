import { config as loadEnv } from "dotenv";
import type { Config } from "drizzle-kit";

// Load .env.local first, then fall back to .env
loadEnv({ path: ".env.local" });
loadEnv();

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error("TURSO_DATABASE_URL is required");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  strict: true,
  verbose: true,
} satisfies Config;
