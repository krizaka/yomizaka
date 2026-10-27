import { open } from "@krizaka/storage";
import { z } from "zod";

import { settingsKey } from "@/app/active-store";
import { query } from "@/lib/db";
import { refuse } from "@/lib/http";

export const s3Body = z.object({ endpoint: z.string().trim().max(300), region: z.string().trim().min(1).max(60), bucket: z.string().trim().min(1).max(100), accessKeyId: z.string().trim().min(1).max(200), secretAccessKey: z.string().max(400).optional() });

/** The secret to test with: the one typed, else the one already sealed in the settings (never sent back to the browser). */
export async function secretFor(owner: string, typed: string | undefined): Promise<string> {
  if (typed) return typed;
  const key = settingsKey();
  const [row] = await query<{ s3_secret_sealed: string | null }>("SELECT s3_secret_sealed FROM storage_settings WHERE owner_id = $1", [owner]);
  if (!row?.s3_secret_sealed || !key) throw refuse(400, "BAD_REQUEST", "The secret access key is required");
  return open(row.s3_secret_sealed, key);
}

