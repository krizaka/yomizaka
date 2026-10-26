import type { ComplianceReport, DocumentInsight } from "@yomizaka/core";

/* Pure (no database, no clock): what the document page shows first — the UX review's Y5 (D1 → D5). The client reads it too. */

type Finding = ComplianceReport["findings"][number];
type Understanding = DocumentInsight["understanding"];

/** The party that names a document, by what the reader is most likely to look for: the other side first, then the issuer. */
const PARTY_ORDER = ["tenant", "landlord", "client", "contractor", "supplier", "buyer", "employee", "employer", "holder", "company"] as const;

/** A document's title as the insight knows it — « Bail de logement — Camille Fictif-Beaulieu » — never the filename when the kind is known; the filename stays as the subtitle (the review's B2). */
export function displayTitle(doc: { title: string; insight?: { understanding: Pick<Understanding, "nature" | "parties" | "issuer"> } | null }, lang: "fr" | "en"): string {
  const u = doc.insight?.understanding;
  const nature = u?.nature;
  if (!u || !nature || (nature.confidence !== "high" && nature.confidence !== "medium")) return doc.title;
  const party = PARTY_ORDER.map((role) => u.parties.find((p) => p.role === role)?.name).find(Boolean) ?? u.parties[0]?.name ?? u.issuer ?? null;
  const title = party ? `${nature.label[lang]} — ${party}` : nature.label[lang];
  return title.length > 120 ? `${title.slice(0, 119)}…` : title;
}

export type VerdictTone = "success" | "warning" | "danger";

/** The verdict in figures, from the report alone (never a verdict of Yomizaka's): the rules read, the points to look at, how many block. */
export function verdictOf(report: Pick<ComplianceReport, "findings" | "summary">): { rules: number; attention: number; blocking: number; unsure: number; passed: number; tone: VerdictTone } {
  const findings = report.findings;
  const failed = findings.filter((f) => f.verdict === "FAIL");
  const unsure = findings.filter((f) => f.verdict === "INSUFFICIENT_EVIDENCE").length;
  const passed = findings.filter((f) => f.verdict === "PASS").length;
  const blocking = report.summary?.blockingFailures ?? failed.filter((f) => f.severity === "BLOCKING").length;
  const rules = report.summary?.rulesEvaluated ?? findings.length;
  const attention = failed.length + unsure;
  const calm = attention > 0 ? "warning" : "success";
  return { rules, attention, blocking, unsure, passed, tone: blocking > 0 ? "danger" : calm };
}

const SEVERITY_RANK: Record<string, number> = { BLOCKING: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
const VERDICT_RANK: Record<string, number> = { FAIL: 0, INSUFFICIENT_EVIDENCE: 1, PASS: 2 };

/** The findings in the order the reader needs: what failed first (blocking before the rest), what could not be checked, then what passed — folded (the review's D1). */
export function orderFindings(findings: readonly Finding[]): { attention: Finding[]; passed: Finding[] } {
  const rank = (f: Finding) => (VERDICT_RANK[f.verdict] ?? 9) * 10 + (SEVERITY_RANK[f.severity] ?? 9);
  const sorted = findings.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map((x) => x.f);
  return { attention: sorted.filter((f) => f.verdict !== "PASS"), passed: sorted.filter((f) => f.verdict === "PASS") };
}

/** A finding with its number on the report: numbered in reading order, what needs a look from 1, what passed going on from there (the signed PDF numbers them the same way). */
export interface NumberedFinding { n: number; finding: Finding }

/** The findings of `orderFindings`, numbered (the Cahier's order: numbers only for a sequence, design § 3.2). */
export function numberFindings(findings: readonly Finding[]): { attention: NumberedFinding[]; passed: NumberedFinding[] } {
  const { attention, passed } = orderFindings(findings);
  return { attention: attention.map((finding, i) => ({ n: i + 1, finding })), passed: passed.map((finding, i) => ({ n: attention.length + i + 1, finding })) };
}

export type SeverityWord = "blocking" | "major" | "advice";

/** A severity in words and tone (the review's D2): bloquant · majeur · conseil — the code stays in the technical details. */
export function severityOf(severity: string): { word: SeverityWord; tone: VerdictTone | "neutral" } {
  if (severity === "BLOCKING") return { word: "blocking", tone: "danger" };
  if (severity === "MAJOR") return { word: "major", tone: "warning" };
  return { word: "advice", tone: "neutral" };
}

/** One amount per kind — the first the insight found — so « Loyer » never appears twice (the review's D3). */
export function amountsOnce<T extends { kind: string }>(amounts: readonly T[]): T[] {
  const seen = new Set<string>();
  return amounts.filter((a) => (seen.has(a.kind) ? false : (seen.add(a.kind), true)));
}
