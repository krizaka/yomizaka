import { env } from "./env";
import { DEVELOPMENT_KEY_BASE64, parseSigningKey, type SigningKey } from "./report-key";

let cached: { material: string; key: SigningKey } | undefined;

/** The key that signs reports: the secret in production (refused at start without it), the public development key elsewhere. */
export function signingKey(): SigningKey {
  const e = env();
  const material = e.APP_REPORT_SIGNING_KEY ?? (e.NODE_ENV === "production" ? undefined : DEVELOPMENT_KEY_BASE64);
  if (!material) throw new Error("APP_REPORT_SIGNING_KEY is not set");
  if (cached?.material !== material) cached = { material, key: parseSigningKey(material, !e.APP_REPORT_SIGNING_KEY) };
  return cached.key;
}
