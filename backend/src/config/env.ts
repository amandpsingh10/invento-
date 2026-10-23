import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// npm workspace scripts run with the workspace folder as cwd (e.g. `backend/`),
// so a bare `dotenv/config` import would look for `backend/.env` instead of
// the repo-root `.env` this project documents. Resolve explicitly from this
// file's own location instead, which is stable whether running via
// `tsx watch src/server.ts` (backend/src/config/env.ts) or the compiled
// `node dist/server.js` (backend/dist/config/env.js) — both are 3 levels
// under the repo root. In Docker/production no .env file exists at all
// (env vars are injected directly), and dotenv silently no-ops when the
// file is missing, so this is safe there too.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  API_URL: z.string().default("http://localhost:4000"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  COOKIE_SECRET: z.string().min(16).default("dev-cookie-secret-please-change-me-32chars"),

  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  MAX_EXCEL_ROWS: z.coerce.number().default(5000),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),

  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. See errors above.");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
