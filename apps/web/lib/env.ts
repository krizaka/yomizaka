import { z } from "zod";

import { parseSigningKey } from "./report-key";

/**
 * Every environment variable of the app, declared once (named by bounded context — APP_, DATABASE_, AUTH_, ABUSE_, AI_ —
 * never by product or vendor: the vendor is a value, `AI_PROVIDER=orazaka`). A production server refuses to start
 * without its secrets (instrumentation.ts calls `assertProductionEnv`): no demo mode, no default key.
 */
const flag = z
  .string()
  .optional()
  .transform((v) => v?.trim().toLowerCase() === "true");
const list = z
  .string()
  .optional()
  .transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** `off` on every dev / preview deployment: noindex everywhere, robots `Disallow: /`, no sitemap, the dev line in the footer (lib/indexing.ts). */
  APP_SEARCH_INDEXING: z.enum(["on", "off"]).default("on"),
  /**
   * `off` on every dev deployment: a signed-out visitor runs nothing (the public verify answers 401 and its page is read-only).
   * Only the dev team uses the dev site; production stays `on`.
   */
  APP_PUBLIC_ACTIONS: z.enum(["on", "off"]).default("on"),
  /** The public origin of the site (canonical URLs, sitemap, llms.txt). */
  APP_PUBLIC_URL: z.string().url().default("https://dev.yomizaka.com"),
  /** PostgreSQL (the cluster krizaka-dev-pg in dev: database yomizaka_db, role yomizaka_db). */
  DATABASE_URL: z.string().optional(),
  /** The cluster's CA (PEM), to verify its certificate; without it a TLS URL is refused in production. */
  DATABASE_CA_CERT: z.string().optional(),
  /** Keys the session tokens' hashes (≥ 32 characters). */
  AUTH_SESSION_SECRET: z.string().optional(),
  /** Sign-up is closed unless this is `true` (closed on every dev deployment: QA accounts only). */
  AUTH_SIGNUP_ENABLED: flag,
  /** The addresses that may open the administration (comma-separated). Empty in production = nobody. */
  AUTH_ALLOWED_IPS: list,
  /** A header the edge sets with the client's address (`do-connecting-ip` on App Platform). */
  ABUSE_CLIENT_IP_HEADER: z.string().optional(),
  ABUSE_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(10).default(1),
  /** Signs the audit reports (Ed25519, base64 of the PKCS#8 DER — `node scripts/generate-report-key.mjs`), a DO SECRET. */
  APP_REPORT_SIGNING_KEY: z.string().optional(),
  /** Where the analyses run: Orazaka, and only Orazaka. */
  AI_PROVIDER: z.literal("orazaka").default("orazaka"),
  /** Orazaka's edge (`https://dev.orazaka.com/edge`). */
  AI_API_URL: z.string().url().default("https://dev.orazaka.com/edge"),
  /** Yomizaka's `oz_` service key (Orazaka `dev-deploy.mjs service-account yomizaka`), a DO SECRET. */
  AI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

/** What a production server cannot run without — named, never shown. */
export function productionProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is not set");
  if (!env.AUTH_SESSION_SECRET || env.AUTH_SESSION_SECRET.length < 32) problems.push("AUTH_SESSION_SECRET must be at least 32 characters");
  if (!env.AI_API_KEY?.startsWith("oz_")) problems.push("AI_API_KEY must be an Orazaka key (oz_…)");
  if (!env.APP_REPORT_SIGNING_KEY) problems.push("APP_REPORT_SIGNING_KEY is not set");
  else
    try {
      parseSigningKey(env.APP_REPORT_SIGNING_KEY);
    } catch (error) {
      problems.push((error as Error).message);
    }
  if (env.DATABASE_URL && /sslmode=(require|verify)/.test(env.DATABASE_URL) && !env.DATABASE_CA_CERT) problems.push("DATABASE_CA_CERT is required for a TLS database");
  return problems;
}

export function assertProductionEnv(source: Record<string, string | undefined> = process.env): void {
  const problems = productionProblems(readEnv(source));
  if (problems.length) throw new Error(`Yomizaka refuses to start: ${problems.join("; ")}`);
}

export const env = () => readEnv();
export const signupEnabled = () => env().AUTH_SIGNUP_ENABLED;
/** The administration's allow-list; `null` = no restriction (development only). */
export function consoleAllowedIps(source: Record<string, string | undefined> = process.env): string[] | null {
  const e = readEnv(source);
  if (e.AUTH_ALLOWED_IPS.length) return e.AUTH_ALLOWED_IPS;
  return e.NODE_ENV === "production" ? [] : null;
}

const DEV_SECRET = "development-only-session-secret-not-for-production";
export function sessionSecret(): string {
  const e = env();
  if (e.AUTH_SESSION_SECRET) return e.AUTH_SESSION_SECRET;
  if (e.NODE_ENV === "production") throw new Error("AUTH_SESSION_SECRET is not set");
  return DEV_SECRET;
}
