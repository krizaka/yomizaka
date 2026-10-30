import { z } from "zod";

import { accountService } from "@/app/accounts-edge";
import { accountAct } from "@/lib/account/act";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  accountAct(req, "profile", async (s) => ({ profile: await accountService().profile(s.account.id) }));

/** Name, language, avatar: each optional, `null` clears the name or the avatar. */
export const PATCH = (req: Request) =>
  accountAct(req, "profile", async (s) => {
    const patch = await readJson(
      req,
      z.object({
        name: z.string().nullable().optional(),
        locale: z.enum(["en", "fr"]).optional(),
        avatarSeed: z.string().nullable().optional(),
      }),
    );
    const profile = await accountService().updateProfile(s.account.id, patch);
    await audit({
      action: "profile.updated",
      actorId: s.account.id,
      actorLabel: s.account.email,
      targetId: s.account.id,
      detail: { fields: Object.keys(patch) },
      headers: req.headers,
    });
    return { profile };
  });
