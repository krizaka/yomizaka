/** The closed sets of a document, shared by the contracts (`index.ts`) and the organisation's rules, which must not import each other. */
export const DOCUMENT_KINDS = ["lease", "contract", "invoice", "other"] as const;
export const DOCUMENT_STATUSES = ["stored", "analysing", "checked", "attention", "failed"] as const;
