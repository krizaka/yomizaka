import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions) => Promise<Buffer>;

/** scrypt (N=2^15, r=8, p=1), a 16-byte salt, stored as `scrypt$N$r$p$salt$hash` (base64url). */
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const OPTIONS = { N, r: R, p: P, maxmem: 64 * 1024 * 1024 };

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export function passwordProblem(password: string): "TOO_SHORT" | "TOO_LONG" | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "TOO_SHORT";
  if (password.length > PASSWORD_MAX_LENGTH) return "TOO_LONG";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, OPTIONS);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash || password.length > PASSWORD_MAX_LENGTH) return false;
  const expected = Buffer.from(hash, "base64url");
  const given = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

let decoy: Promise<string> | undefined;
/** A hash to verify against when the address has no account: the same work, the same time, the same answer. */
export const decoyHash = () => (decoy ??= hashPassword(crypto.randomBytes(24).toString("base64url")));
