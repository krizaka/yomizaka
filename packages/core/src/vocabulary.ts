/** The closed sets of a document, shared by the contracts (`index.ts`) and the organisation's rules, which must not import each other. */
export const DOCUMENT_KINDS = ["lease", "contract", "invoice", "other"] as const;
export const DOCUMENT_STATUSES = ["stored", "analysing", "checked", "attention", "failed"] as const;

/** The tabs of a document, each its own route: /app/documents/[id]/<tab> (the URL is the state), on the web and in the apps. */
export const DOCUMENT_TABS = ["infos", "verifications", "fichier", "texte"] as const;
export type DocumentTab = (typeof DOCUMENT_TABS)[number];
