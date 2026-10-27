import { z } from "zod";

import authenticity from "./data/document-authenticity.json";
import invoice from "./data/qc-invoice.json";
import lease from "./data/qc-residential-lease.json";
import service from "./data/qc-service-contract.json";
import templatesJson from "./data/templates.json";
import { type Lang } from "./vocabulary";

/** A text in both languages: the note is written once per language and never translated by code. */
const bilingual = z.object({ fr: z.string().min(1), en: z.string().min(1) });
export type Bilingual = z.infer<typeof bilingual>;
export const say = (text: Bilingual, lang: Lang): string => text[lang];

const rulePlain = z.object({ ok: bilingual, attention: bilingual, advice: bilingual });

/** The plain-language text of a rules pack, stored as data with the pack (here, until the packs repository carries it). */
const compliancePack = z.object({
  pack: z.string(),
  what: bilingual,
  scope: bilingual,
  notChecked: z.array(bilingual),
  rules: z.record(z.string(), rulePlain),
  /** Each rule's name in both languages (French: the ruleset's own words, kept exact). A rule without one fails the parse, so the build. */
  ruleTitles: z.record(z.string(), bilingual),
  unknown: z.record(z.string(), bilingual),
});
export type CompliancePack = z.infer<typeof compliancePack>;

const authenticityPack = z.object({
  pack: z.string(),
  what: bilingual,
  notChecked: z.array(bilingual),
  levels: z.record(z.string(), bilingual),
  advice: z.record(z.string(), bilingual),
});
export type AuthenticityPack = z.infer<typeof authenticityPack>;

export const templates = z
  .object({ title: bilingual, headings: z.record(z.string(), bilingual), how: z.array(bilingual), howAuthenticity: z.array(bilingual), source: z.record(z.string(), bilingual) })
  .catchall(z.unknown())
  .parse(templatesJson) as Record<string, Bilingual | Bilingual[] | Record<string, Bilingual>>;

const COMPLIANCE_PACKS = new Map(([lease, invoice, service] as unknown[]).map((raw) => compliancePack.parse(raw)).map((p) => [p.pack, p]));
export const compliancePackOf = (rulesetId: string): CompliancePack | undefined => COMPLIANCE_PACKS.get(rulesetId);
export const authenticityData: AuthenticityPack = authenticityPack.parse(authenticity);
export const allCompliancePacks = (): readonly CompliancePack[] => [...COMPLIANCE_PACKS.values()];
export const PACKS_WITH_NOTES: readonly string[] = [...COMPLIANCE_PACKS.keys()];

export const template = (key: string): Bilingual => templates[key] as Bilingual;
