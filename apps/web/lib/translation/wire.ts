import type { Analysis } from "@yomizaka/core";

import { query } from "../db";
import { refuse } from "../http";
import { assertFeature, settingsFor } from "../settings/guards";
import { orazakaTranslation } from "./orazaka";
import type { Lang, TranslationPort } from "./port";
import { translate, type TranslationView } from "./service";
import { pgTranslationStore, readGlossary } from "./store";

/** The translation of an analysis for its owner, wired to this app: the switch, the languages offered, the credits, the store, the port. */
export async function translationFor(ownerId: string, analysis: Pick<Analysis, "id" | "report">, language: Lang, port: TranslationPort = orazakaTranslation): Promise<TranslationView> {
  await assertFeature("reportTranslation", ownerId);
  const settings = await settingsFor(ownerId);
  const offered = settings["features.reportLanguages"].value as readonly string[];
  if (!offered.includes(language)) throw refuse(403, "LANGUAGE_NOT_OFFERED", "This language is not offered for reports", { language });
  return translate(analysis, language, {
    port,
    store: pgTranslationStore,
    glossary: readGlossary,
    credits: settings["limits.reportTranslationCredits"].value as number,
    spend: async (credits) => {
      if (credits < 1) return;
      const rows = await query("UPDATE accounts SET audit_credits = audit_credits - $2 WHERE id = $1 AND audit_credits >= $2 RETURNING id", [ownerId, credits]);
      if (!rows.length) throw refuse(402, "PAYWALL", "Not enough credits to translate this report");
    },
    refund: async (credits) => {
      if (credits >= 1) await query("UPDATE accounts SET audit_credits = audit_credits + $2 WHERE id = $1", [ownerId, credits]);
    },
  });
}
