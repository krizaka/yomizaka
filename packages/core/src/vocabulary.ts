/** The closed sets of a document, shared by the contracts (`index.ts`) and the organisation's rules, which must not import each other. */
export const DOCUMENT_KINDS = ["lease", "contract", "invoice", "other"] as const;
export const DOCUMENT_STATUSES = ["stored", "analysing", "checked", "attention", "failed"] as const;

/** The tabs of a document, each its own route: /app/documents/[id]/<tab> (the URL is the state), on the web and in the apps — the report first, the document (file, text, what it holds), the history of its runs. */
export const DOCUMENT_TABS = ["rapport", "document", "historique"] as const;
export type DocumentTab = (typeof DOCUMENT_TABS)[number];
/** The four addresses of before (the UX review's Y5), each answering 308 to the tab that holds it now. */
export const OLD_DOCUMENT_TABS: Readonly<Record<string, DocumentTab>> = { infos: "document", fichier: "document", texte: "document", verifications: "rapport" };
