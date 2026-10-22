import { PII_PATTERNS } from "./patterns";
import { createScanner } from "./scan";

export type * from "./port";
export { createScanner } from "./scan";
export const personalInfo = createScanner(PII_PATTERNS);
export { PII_PATTERNS };
