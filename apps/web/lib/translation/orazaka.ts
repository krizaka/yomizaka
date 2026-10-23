import { fromRunStatus } from "@yomizaka/core";
import { z } from "zod";

import { orazaka } from "../orazaka";
import type { TranslationOutcome, TranslationPort } from "./port";

/**
 * The port over Orazaka's Studio `text-translation` (krizaka/orazaka-packs#119). Contract assumed from that issue, to check when
 * the Studio merges: inputs `sourceLocale`, `targetLocales` (JSON), `fields` (JSON `{ key, text, maxLength, kind }[]`),
 * `glossary` (JSON `{ source, target }[]`); output `translations` (JSON `{ key, locale, text }[]`, one per field and locale).
 */
export const TRANSLATION_STUDIO = "text-translation" as const;
const output = z.array(z.object({ key: z.string(), locale: z.string(), text: z.string() }));

export const orazakaTranslation: TranslationPort = {
  async start({ source, target, fields, glossary }) {
    const run = await orazaka().startRun(TRANSLATION_STUDIO, {
      sourceLocale: source,
      targetLocales: JSON.stringify([target]),
      fields: JSON.stringify(fields),
      glossary: JSON.stringify(glossary),
    });
    return { runId: run.id };
  },
  async read(runId): Promise<TranslationOutcome> {
    const run = await orazaka().getRun(runId);
    const status = fromRunStatus(run.status);
    if (status === "running") return { state: "running", runId };
    if (status !== "succeeded") return { state: "failed", runId, reason: run.errorMessage ?? `The run ended ${run.status}` };
    const raw = run.outputs.find((o) => o.key === "translations")?.value;
    let parsed: ReturnType<typeof output.safeParse>;
    try {
      parsed = output.safeParse(JSON.parse(raw ?? "null"));
    } catch {
      return { state: "failed", runId, reason: "The Studio's answer is not JSON" };
    }
    if (!parsed.success) return { state: "failed", runId, reason: "The Studio's answer has an unexpected shape" };
    return { state: "done", runId, studioVersion: run.blueprintVersion ?? null, texts: Object.fromEntries(parsed.data.map((t) => [t.key, t.text])) };
  },
};
