import { z } from "zod";

import { providers } from "@/app/storage-providers";
import { query } from "@/lib/db";
import { refuse } from "@/lib/http";
import { storedSecret } from "@/lib/storage/own-providers";

export const s3Body = z.object({ endpoint: z.string().trim().max(300), region: z.string().trim().min(1).max(60), bucket: z.string().trim().min(1).max(100), accessKeyId: z.string().trim().min(1).max(200), secretAccessKey: z.string().max(400).optional() });

/** The secret to test with: the one typed, else the one already stored in the registry (never sent back to the browser). */
export async function secretFor(owner: string, typed: string | undefined): Promise<string> {
  if (typed) return typed;
  const registry = providers();
  const [row] = await query<{ provider_id: string | null }>("SELECT provider_id FROM storage_settings WHERE owner_id = $1", [owner]);
  const stored = registry ? await storedSecret(registry, row?.provider_id ?? null) : null;
  if (!stored) throw refuse(400, "BAD_REQUEST", "The secret access key is required");
  return stored;
}
