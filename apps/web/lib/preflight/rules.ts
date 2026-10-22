import { MAX_FILE_BYTES } from "@yomizaka/core";

import type { PreflightRules } from "./port";

/**
 * Yomizaka's pre-flight rules — data. The limits follow the product: a lease, an invoice or a contract is a PDF or a text
 * file of at most 10 MB. Images and Word files are RECOGNISED (so the refusal can say what they are) but not accepted yet.
 */
export const YOMIZAKA_RULES: PreflightRules = {
  maxBytes: MAX_FILE_BYTES,
  allowedKinds: ["pdf", "text"],
  maxPages: 200,
  maxArchiveEntries: 1000,
  maxArchiveBytes: 100 * 1024 * 1024,
  maxArchiveRatio: 100,
  pdfActiveNames: ["JavaScript", "JS", "Launch", "EmbeddedFile", "EmbeddedFiles", "OpenAction", "AA", "RichMedia", "XFA", "ImportData", "SubmitForm"],
};
