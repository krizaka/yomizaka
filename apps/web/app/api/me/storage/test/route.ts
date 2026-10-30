import crypto from "node:crypto";

import { s3Body, secretFor } from "@/app/own-s3";
import { openContextOf } from "@/app/storage-providers";
import { accountAct } from "@/lib/account/act";
import { readJson } from "@/lib/http";
import { assertFeature } from "@/lib/settings/guards";
import { verifyS3 } from "@/lib/storage/verify";

export const dynamic = "force-dynamic";

/** « Test the connection »: a probe object is written, read back and deleted on the bucket — and the person sees where that data would live. Nothing is saved. */
export const POST = (req: Request) =>
  accountAct(req, "storage-test", async (s) => {
    await assertFeature("ownStorage", s.account.id);
    const input = await readJson(req, s3Body);
    const verification = await verifyS3(
      { ...input, secretAccessKey: await secretFor(s.account.id, input.secretAccessKey) },
      { ctx: openContextOf(), probeId: crypto.randomUUID() },
    );
    return { verification };
  });
