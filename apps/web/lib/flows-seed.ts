import type { FlowDefinition, FlowEnvironment } from "@yomizaka/core";

/**
 * The flows that exist today, as definitions (ADR-0003): seeded into the database at start, once (an existing key is left
 * alone — the administration owns it afterwards), and the only fallback the public pages use when the database cannot be
 * reached. The Québec ruleset is data of the Orazaka pack `document-validation`; the French and Walloon ones are offered to
 * the landlord and the tenant alike.
 */
const COMPLIANCE = {
  id: "compliance",
  kind: "studio" as const,
  studio: "compliance-check" as const,
  pack: "document-validation",
  jurisdictions: [
    { code: "QC" as const, ruleset: "qc-residential-lease" },
    { code: "FR" as const, ruleset: "fr-residential-lease" },
    { code: "BE-WAL" as const, ruleset: "be-residential-lease" },
  ],
};
const AUTHENTICITY = { id: "authenticity", kind: "studio" as const, studio: "document-authenticity" as const, pack: "document-validation", jurisdictions: [] };

export interface SeedFlow {
  key: string;
  definition: FlowDefinition;
  environments: readonly FlowEnvironment[];
}

export const SEED_FLOWS: readonly SeedFlow[] = [
  {
    key: "lease-check-tenant",
    environments: ["dev", "prod"],
    definition: {
      title: { en: "Check your lease before you sign", fr: "Vérifiez votre bail avant de signer" },
      lead: { en: "Your lease against Québec's rules, line by line.", fr: "Votre bail au regard des règles du Québec, ligne par ligne." },
      status: "available",
      audiences: ["tenant"],
      steps: [COMPLIANCE, AUTHENTICITY],
      consents: [],
      providers: [],
      pricing: { model: "free" },
    },
  },
  {
    key: "lease-check-landlord",
    environments: ["dev", "prod"],
    definition: {
      title: { en: "A compliant lease before you send it", fr: "Un bail conforme avant de l'envoyer" },
      lead: { en: "Your lease template against Québec's rules, and the tenant's papers examined.", fr: "Votre modèle de bail au regard des règles du Québec, et les pièces du locataire examinées." },
      status: "available",
      audiences: ["landlord"],
      steps: [COMPLIANCE, AUTHENTICITY],
      consents: [],
      providers: [],
      pricing: { model: "free" },
    },
  },
  {
    key: "file-check-freelancer",
    environments: ["dev"],
    definition: {
      title: { en: "Contracts and invoices for freelancers", fr: "Contrats et factures pour travailleurs autonomes" },
      lead: { en: "The PDF examined today; the contract and invoice rules are coming.", fr: "Le PDF examiné dès aujourd'hui ; les règles des contrats et des factures arrivent." },
      status: "soon",
      audiences: ["freelancer"],
      steps: [AUTHENTICITY],
      consents: [],
      providers: [],
      pricing: { model: "free" },
    },
  },
  {
    key: "file-check-business",
    environments: ["dev"],
    definition: {
      title: { en: "Supplier contracts and received invoices", fr: "Contrats de fournisseurs et factures reçues" },
      lead: { en: "The PDF examined today; the contract and invoice rules are coming.", fr: "Le PDF examiné dès aujourd'hui ; les règles des contrats et des factures arrivent." },
      status: "soon",
      audiences: ["business"],
      steps: [AUTHENTICITY],
      consents: [],
      providers: [],
      pricing: { model: "free" },
    },
  },
];
