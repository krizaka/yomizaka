import { z } from "zod";

/*
 * Yomizaka's contracts — what the API answers and the web reads, validated on both sides. Structure only: the words are
 * messages (apps/web/messages). Every analysis is an Orazaka run: these schemas describe what Yomizaka keeps of it (the
 * run id, its status, the report Orazaka returned), never a verdict of its own.
 */

/** The largest file Yomizaka keeps (the MVP stores files in its own database). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** The largest PDF Orazaka's authenticity Studio reads (its input is the file in base64, ≤ 1 400 000 characters). */
export const AUTHENTICITY_MAX_BYTES = 1_000_000;
/** The longest text Orazaka's compliance Studio reads (its `document` input). */
export const COMPLIANCE_MAX_CHARS = 60_000;
/** What can be uploaded: a PDF (its text layer is read) or plain text. */
export const ACCEPTED_TYPES = ["application/pdf", "text/plain"] as const;
export const acceptedType = z.enum(ACCEPTED_TYPES);

export const DOCUMENT_KINDS = ["lease", "contract", "invoice", "other"] as const;
export const documentKind = z.enum(DOCUMENT_KINDS);
export type DocumentKind = z.infer<typeof documentKind>;

/**
 * Which side of the lease a person is on: the tenant (locataire) checks a lease before signing, the landlord (locateur,
 * « propriétaire » in everyday words) checks a template and the tenant's papers. It changes the defaults and the wording,
 * never the rules: both sides run the same Orazaka Studios on the same rulesets.
 */
export const PERSPECTIVES = ["tenant", "landlord"] as const;
export const perspective = z.enum(PERSPECTIVES);
export type Perspective = z.infer<typeof perspective>;

/**
 * Who the person is, for the product: the audiences of « Pour qui ? ». `available` ones have rules that run today; `soon`
 * ones are offered honestly as « bientôt » — never a claimed check that does not run (docs/product/direction-2026-10.md).
 */
export const AUDIENCES = ["tenant", "landlord", "freelancer", "business"] as const;
export const audience = z.enum(AUDIENCES);
export type Audience = z.infer<typeof audience>;
export const AUDIENCE_STATUS = { tenant: "available", landlord: "available", freelancer: "available", business: "available" } as const satisfies Record<Audience, "available" | "soon">;

/**
 * A flow is data administered in the database (ADR-0003): who it is offered to, the Orazaka Studio and the rulesets of each
 * step, the consents it requires, the providers it uses, its price. The app only reads it.
 */
export const FLOW_ENVIRONMENTS = ["dev", "prod"] as const;
export const flowEnvironment = z.enum(FLOW_ENVIRONMENTS);
export type FlowEnvironment = z.infer<typeof flowEnvironment>;
export const FLOW_VERSION_STATUSES = ["draft", "published", "retired"] as const;
export const flowVersionStatus = z.enum(FLOW_VERSION_STATUSES);
export type FlowVersionStatus = z.infer<typeof flowVersionStatus>;
/** Named values, so no code compares a field to a magic string. */
export const VERSION_STATUS = { draft: "draft", published: "published", retired: "retired" } as const satisfies Record<FlowVersionStatus, FlowVersionStatus>;
export const FLOW_STATUS = { available: "available", soon: "soon" } as const;
export const STEP_KIND = { studio: "studio", provider: "provider" } as const;

const localised = z.object({ en: z.string().trim().min(1).max(300), fr: z.string().trim().min(1).max(300) });
export const flowStep = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  /** `studio`: an Orazaka Studio of a pack. `provider`: an external provider (a credit bureau…). */
  kind: z.enum(["studio", "provider"]),
  studio: z.enum(["compliance-check", "document-authenticity"]).optional(),
  pack: z.string().max(60).optional(),
  /** The rulesets of the compliance Studio, by jurisdiction — data of the pack, never code here. */
  jurisdictions: z.array(z.object({ code: z.enum(["QC", "FR", "BE-WAL"]), ruleset: z.string().min(1).max(80) })).max(10).default([]),
  provider: z.string().max(60).optional(),
});
export type FlowStep = z.infer<typeof flowStep>;
export const flowDefinition = z.object({
  title: localised,
  lead: localised,
  status: z.enum(["available", "soon"]),
  audiences: z.array(z.enum(["tenant", "landlord", "freelancer", "business"])).min(1),
  steps: z.array(flowStep).max(12),
  consents: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(8).default([]),
  providers: z.array(z.string().max(60)).max(8).default([]),
  pricing: z.object({ model: z.enum(["free", "per-run", "subscription"]), amountCents: z.number().int().min(0).max(1_000_000).optional() }).default({ model: "free" }),
});
export type FlowDefinition = z.infer<typeof flowDefinition>;

/** What flows offer on a document: the Studios and, for the compliance Studio, the jurisdictions (with their rulesets). A « soon » flow offers the steps that run today. */
export function offerOf(definitions: readonly FlowDefinition[]): { studios: Studio[]; jurisdictions: Jurisdiction[]; rulesets: string[] } {
  const studios = new Set<Studio>();
  const jurisdictions = new Set<Jurisdiction>();
  const rulesets = new Set<string>();
  for (const d of definitions) {
    for (const s of d.steps) {
      if (s.kind !== STEP_KIND.studio || !s.studio) continue;
      studios.add(s.studio);
      for (const j of s.jurisdictions) {
        jurisdictions.add(j.code);
        rulesets.add(j.ruleset);
      }
    }
  }
  return { studios: STUDIOS.filter((s) => studios.has(s)), jurisdictions: JURISDICTIONS.filter((j) => jurisdictions.has(j)), rulesets: [...rulesets] };
}

/** The two Orazaka Studios of the document-validation pack Yomizaka runs. */
export const STUDIOS = ["compliance-check", "document-authenticity"] as const;
export const studio = z.enum(STUDIOS);
export type Studio = z.infer<typeof studio>;

/** The rulesets the compliance Studio carries (orazaka-packs document-validation/rulesets). Québec first: our market. */
export const JURISDICTIONS = ["QC", "FR", "BE-WAL"] as const;
export const jurisdiction = z.enum(JURISDICTIONS);
export type Jurisdiction = z.infer<typeof jurisdiction>;

export const ANALYSIS_STATUSES = ["running", "succeeded", "failed", "cancelled"] as const;
export const analysisStatus = z.enum(ANALYSIS_STATUSES);
export type AnalysisStatus = z.infer<typeof analysisStatus>;

/** Orazaka's run statuses (orazaka-studio RunStatus) as Yomizaka shows them. Unknown → running (it will be asked again). */
export function fromRunStatus(status: string): AnalysisStatus {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "running";
  }
}

export const isTerminal = (status: AnalysisStatus) => status !== "running";

/** A document's state in the library, derived from its analyses. */
export const DOCUMENT_STATUSES = ["stored", "analysing", "checked", "attention", "failed"] as const;
export const documentStatus = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof documentStatus>;

// ── Reports, as Orazaka returns them (orazaka-packs document-validation) ─────────────────────────────────────────────

export const VERDICTS = ["PASS", "FAIL", "INSUFFICIENT_EVIDENCE"] as const;
export const finding = z.object({
  ruleId: z.string(),
  title: z.string().optional(),
  severity: z.string(),
  verdict: z.string(),
  evidenceSpan: z.object({ start: z.number().nullish(), end: z.number().nullish(), quote: z.string() }).nullable().optional(),
  explanation: z.string(),
  method: z.string().optional(),
  citation: z.string().optional(),
});
export type Finding = z.infer<typeof finding>;

export const complianceReport = z.object({
  rulesetId: z.string(),
  rulesetVersion: z.string(),
  rulesetRevision: z.number().optional(),
  jurisdiction: z.string(),
  asOf: z.string(),
  source: z.string().optional(),
  /** `TO_REVIEW_BY_LAWYER` while the ruleset awaits a lawyer's review (the Québec one does). */
  reviewStatus: z.string().optional(),
  reviewNote: z.string().optional(),
  summary: z.object({ byVerdict: z.record(z.string(), z.number()), blockingFailures: z.number(), rulesEvaluated: z.number() }).partial().optional(),
  findings: z.array(finding),
});
export type ComplianceReport = z.infer<typeof complianceReport>;

export const SIGNAL_LEVELS = ["observé", "inhabituel", "incohérent"] as const;
export const signal = z.object({
  signalId: z.string(),
  level: z.string(),
  observation: z.string(),
  mayIndicate: z.string().optional(),
  where: z.string().optional(),
});
export type Signal = z.infer<typeof signal>;

export const authenticityReport = z.object({
  header: z.string().optional(),
  pages: z.number().optional(),
  signals: z.array(signal),
  levels: z.record(z.string(), z.string()).optional(),
  notExamined: z.union([z.string(), z.array(z.string())]).optional(),
});
export type AuthenticityReport = z.infer<typeof authenticityReport>;

/** One output of an Orazaka run (orazaka-studio RunArtefactResponse). */
export const runArtefact = z.object({ key: z.string(), label: z.string().nullable().optional(), type: z.string(), value: z.string().nullable().optional() });
export type RunArtefact = z.infer<typeof runArtefact>;

/** An Orazaka run, as the edge answers it (`GET /api/v1/studios/runs/{id}`). Only what Yomizaka reads. */
export const orazakaRun = z.object({
  id: z.string(),
  studioKey: z.string(),
  blueprintVersion: z.string().nullable().optional(),
  status: z.string(),
  outputs: z.array(runArtefact).default([]),
  errorMessage: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
});
export type OrazakaRun = z.infer<typeof orazakaRun>;

const json = (value: string | null | undefined): unknown => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

/**
 * The report a finished run carries, read from its outputs: the compliance Studio's `report` (JSON — the assembled
 * report, wrapped in `{ report }` or bare), the authenticity Studio's `signals` (JSON). A shape Orazaka did not send is
 * `null`, never a guess.
 */
export function reportOf(studioKey: Studio, outputs: readonly RunArtefact[]): ComplianceReport | AuthenticityReport | null {
  const pick = (key: string) => outputs.find((o) => o.key === key)?.value;
  if (studioKey === "compliance-check") {
    const raw = json(pick("report")) as { report?: unknown } | undefined;
    const parsed = complianceReport.safeParse(raw && typeof raw === "object" && "report" in raw ? raw.report : raw);
    return parsed.success ? parsed.data : null;
  }
  const raw = json(pick("signals")) as { report?: unknown } | undefined;
  const parsed = authenticityReport.safeParse(raw && typeof raw === "object" && "report" in raw ? raw.report : raw);
  return parsed.success ? parsed.data : null;
}

// ── The API ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const analysis = z.object({
  id: z.string(),
  studio,
  status: analysisStatus,
  /** The Orazaka run this analysis is — shown in the UI, the trace of what ran. */
  runId: z.string().nullable(),
  blueprintVersion: z.string().nullable(),
  inputs: z.record(z.string(), z.string()),
  report: z.union([complianceReport, authenticityReport]).nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type Analysis = z.infer<typeof analysis>;

export const documentSummary = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string(),
  mimeType: acceptedType,
  kind: documentKind,
  sizeBytes: z.number().int().nonnegative(),
  pages: z.number().int().nullable(),
  /** Whether a text layer was read (a scanned PDF has none: the compliance check needs one). */
  hasText: z.boolean(),
  status: documentStatus,
  createdAt: z.string(),
});
export type DocumentSummary = z.infer<typeof documentSummary>;

/** What the document is and what it holds, read in-process from its text (apps/web/lib/understanding, lib/pii). Values of personal information are never here — only counts. */
const labelled = z.object({ fr: z.string(), en: z.string() });
export const documentInsight = z.object({
  understanding: z.object({
    nature: z.object({ id: z.string(), label: labelled, confidence: z.enum(["high", "medium", "low", "unknown"]), score: z.number() }).nullable(),
    alternative: z.object({ id: z.string(), label: labelled }).nullable(),
    language: z.enum(["fr", "en", "unknown"]),
    pages: z.number().nullable(),
    issuer: z.string().nullable(),
    dates: z.array(z.object({ kind: z.enum(["issued", "effective", "due", "period", "other"]), value: z.string(), text: z.string() })),
    parties: z.array(z.object({ role: z.string(), name: z.string() })),
    references: z.array(z.object({ kind: z.string(), value: z.string() })),
    amounts: z.array(z.object({ kind: z.string(), cents: z.number(), text: z.string() })),
    check: z.object({ studio: z.literal("compliance-check"), documentType: z.enum(["lease", "invoice", "contract"]), ruleset: z.string().nullable() }).nullable(),
    authenticity: z.boolean(),
    needsModel: z.boolean(),
  }),
  pii: z.object({ total: z.number(), counts: z.record(z.string(), z.number()) }),
});
export type DocumentInsight = z.infer<typeof documentInsight>;

export const documentDetail = documentSummary.extend({
  insight: documentInsight.optional(),
  sha256: z.string(),
  text: z.string(),
  analyses: z.array(analysis),
});
export type DocumentDetail = z.infer<typeof documentDetail>;

/** The rulesets the Studio takes by name besides each jurisdiction's lease (orazaka-packs `document-validation` 1.3.0+): Québec's supplier invoice and service contract. */
export const NAMED_RULESETS = ["qc-invoice", "qc-service-contract"] as const;
export const namedRuleset = z.enum(NAMED_RULESETS);

export const startAnalysis = z.discriminatedUnion("studio", [
  z.object({
    studio: z.literal("compliance-check"),
    jurisdiction,
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** Not the jurisdiction's lease but this document type's rules; the Québec invoice belongs to QC only. */
    ruleset: namedRuleset.optional(),
  }).refine((r) => !r.ruleset || r.jurisdiction === "QC", { message: "The invoice and contract rules are Québec's", path: ["ruleset"] }),
  z.object({
    studio: z.literal("document-authenticity"),
    expectedIssuer: z.string().trim().max(120).optional(),
  }),
]);
export type StartAnalysis = z.infer<typeof startAnalysis>;

export const searchHit = z.object({
  documentId: z.string(),
  title: z.string(),
  kind: documentKind,
  /** Where the words were found: the document's text, or a finding of one of its analyses. */
  source: z.enum(["text", "finding", "title"]),
  /** The passage, `<b>…</b>` around the matched words (the server escapes everything else). */
  passage: z.string(),
  rank: z.number(),
});
export type SearchHit = z.infer<typeof searchHit>;

export const adminUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  documents: z.number().int(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
});
export type AdminUser = z.infer<typeof adminUser>;

/** The query keys of @krizaka/query — one place, so an invalidation never misses a list. */
export const queryKeys = {
  documents: () => ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  search: (q: string) => ["search", q] as const,
  adminUsers: () => ["admin", "users"] as const,
};

/**
 * The document's text cut around the passages a report quotes, for the viewer: plain runs and marked runs, in order.
 * A quote is found by its offsets when they still match the text, else by its first occurrence; a quote that is not in
 * the text is left out (it is shown in the finding, never invented in the document).
 */
export function passages(text: string, quotes: readonly { id: string; quote: string; start?: number | null; end?: number | null }[]): { text: string; mark?: string }[] {
  const spans: { start: number; end: number; id: string }[] = [];
  for (const q of quotes) {
    if (!q.quote) continue;
    const start = typeof q.start === "number" && text.slice(q.start, q.start + q.quote.length) === q.quote ? q.start : text.indexOf(q.quote);
    if (start < 0) continue;
    const end = start + q.quote.length;
    if (spans.some((s) => start < s.end && end > s.start)) continue;
    spans.push({ start, end, id: q.id });
  }
  spans.sort((a, b) => a.start - b.start);
  const out: { text: string; mark?: string }[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) out.push({ text: text.slice(at, s.start) });
    out.push({ text: text.slice(s.start, s.end), mark: s.id });
    at = s.end;
  }
  if (at < text.length || out.length === 0) out.push({ text: text.slice(at) });
  return out;
}
