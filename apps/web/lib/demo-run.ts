import type { ComplianceReport } from "@yomizaka/core";

/**
 * The real run the public page shows (« A real run »): recorded from dev.orazaka.com by `scripts/record-demo.mjs` — a
 * sample lease sent to Orazaka's compliance Studio, the run id and the report exactly as they came back. `null` until
 * it has run: the page then says so instead of showing an invented result.
 */
export interface DemoRun {
  runId: string;
  studio: "compliance-check";
  blueprintVersion: string | null;
  finishedAt: string;
  document: string;
  report: ComplianceReport;
}

export const DEMO_RUN: DemoRun | null = {
  "runId": "09272962-5336-4272-9cb3-19cc0071eb78",
  "studio": "compliance-check",
  "blueprintVersion": "1.2.0",
  "finishedAt": "2026-10-15T09:17:13.582084Z",
  "document": "BAIL DE LOGEMENT — 4½, rue Saint-Denis, Montréal\nEntre le locateur Monsieur Marc Tremblay, domicilié à Montréal,\net la locataire Madame Sophie Gagnon.\nDurée : 12 mois, du 1er juillet 2026 au 30 juin 2027.\nLoyer mensuel : 1 450 $, payable le premier jour du mois.\nLa locataire verse un dépôt de sécurité de 1 450 $ à la signature.\nLa locataire remet douze chèques postdatés.\nIl est interdit d'avoir des enfants dans le logement.",
  "report": {
    "rulesetId": "qc-residential-lease",
    "rulesetVersion": "2024-02-21",
    "rulesetRevision": 1,
    "jurisdiction": "QC",
    "asOf": "2026-10-15",
    "source": "Code civil du Québec, art. 1851 et suiv. (bail de logement : art. 1892 à 1978), Règlement sur les formulaires de bail obligatoires et sur les mentions de l'avis au nouveau locataire (RLRQ c. T-15.01, r. 3), Tribunal administratif du logement",
    "summary": {
      "byVerdict": {
        "PASS": 4,
        "FAIL": 5
      },
      "blockingFailures": 3,
      "rulesEvaluated": 9
    },
    "findings": [
      {
        "ruleId": "QC-LEASE-001",
        "title": "Identification du locateur",
        "severity": "BLOCKING",
        "verdict": "PASS",
        "evidenceSpan": {
          "start": 58,
          "end": 75,
          "quote": "locateur Monsieur"
        },
        "explanation": "Le locateur est identifié au bail.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1895 ; Règlement sur les formulaires de bail obligatoires, section A"
      },
      {
        "ruleId": "QC-LEASE-002",
        "title": "Identification du locataire",
        "severity": "BLOCKING",
        "verdict": "PASS",
        "evidenceSpan": {
          "start": 119,
          "end": 135,
          "quote": "locataire Madame"
        },
        "explanation": "Le locataire est identifié au bail.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1895 ; Règlement sur les formulaires de bail obligatoires, section A"
      },
      {
        "ruleId": "QC-LEASE-003",
        "title": "Montant du loyer",
        "severity": "BLOCKING",
        "verdict": "PASS",
        "evidenceSpan": {
          "start": 205,
          "end": 228,
          "quote": "Loyer mensuel : 1 450 $"
        },
        "explanation": "Le loyer est chiffré au bail.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1855 et 1903 ; Règlement sur les formulaires de bail obligatoires, section D"
      },
      {
        "ruleId": "QC-LEASE-004",
        "title": "Dépôt de garantie interdit — seul le premier mois peut être exigé d'avance",
        "severity": "BLOCKING",
        "verdict": "FAIL",
        "evidenceSpan": {
          "start": 285,
          "end": 313,
          "quote": "dépôt de sécurité de 1 450 $"
        },
        "explanation": "Le bail exige un dépôt de garantie. L'article 1904 ne permet au locateur d'exiger d'avance que le premier mois de loyer.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1904, al. 1"
      },
      {
        "ruleId": "QC-LEASE-005",
        "title": "Chèques postdatés interdits",
        "severity": "BLOCKING",
        "verdict": "FAIL",
        "evidenceSpan": {
          "start": 355,
          "end": 372,
          "quote": "chèques postdatés"
        },
        "explanation": "Le bail exige des chèques postdatés. L'article 1904 interdit au locateur d'exiger la remise de chèques ou d'autres effets postdatés.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1904, al. 2"
      },
      {
        "ruleId": "QC-LEASE-006",
        "title": "Refus des enfants — sans effet",
        "severity": "BLOCKING",
        "verdict": "FAIL",
        "evidenceSpan": {
          "start": 381,
          "end": 409,
          "quote": "interdit d'avoir des enfants"
        },
        "explanation": "Une clause écarte les enfants. L'article 1899 interdit au locateur de refuser un locataire, ou de maintenir une clause, en raison de la présence d'enfants.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1899"
      },
      {
        "ruleId": "QC-LEASE-007",
        "title": "Renonciation au droit au maintien dans les lieux — sans effet",
        "severity": "BLOCKING",
        "verdict": "PASS",
        "evidenceSpan": null,
        "explanation": "Aucune renonciation au maintien dans les lieux.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1936 et 1893"
      },
      {
        "ruleId": "QC-LEASE-008",
        "title": "Avis du loyer le plus bas des douze derniers mois",
        "severity": "MAJOR",
        "verdict": "FAIL",
        "evidenceSpan": null,
        "explanation": "Le bail ne mentionne pas le loyer le plus bas payé au cours des douze mois précédant le début du bail (section G). L'article 1896 oblige le locateur à le remettre au nouveau locataire.",
        "method": "DETERMINISTIC",
        "citation": "C.c.Q., art. 1896 ; Règlement sur les formulaires de bail obligatoires, section G"
      },
      {
        "ruleId": "QC-LEASE-020",
        "title": "Clause abusive",
        "severity": "ADVISORY",
        "verdict": "FAIL",
        "evidenceSpan": {
          "start": null,
          "end": null,
          "quote": "Il est interdit d'avoir des enfants dans le logement."
        },
        "explanation": "Une clause paraît abusive ; l'article 1901 permet au Tribunal administratif du logement de l'annuler ou d'en réduire l'obligation.",
        "method": "JUDGMENT",
        "citation": "C.c.Q., art. 1901"
      }
    ],
    "reviewStatus": "TO_REVIEW_BY_LAWYER",
    "reviewNote": "Corpus rédigé à partir du texte public du Code civil du Québec ; chaque règle cite son article. À faire relire par un avocat ou une avocate membre du Barreau du Québec avant tout usage autre que la démonstration."
  }
};
