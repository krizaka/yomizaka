# ADR-0012 — The check report in French and English

Status: accepted (2026-10-23). Issue: krizaka/yomizaka#246. Studio: `text-translation` (krizaka/orazaka-packs#119, being built).

## Context
Orazaka's rules and reports are written in French. A reader (or a partner) must be able to read the report, and receive the signed
PDF, in English as well. The interface words already come from the catalogues; what must be translated is the **generated text**.

## Decision
- **Through Orazaka only, behind a port** (`lib/translation/port.ts`): Yomizaka never translates. The adapter (`lib/translation/orazaka.ts`)
  starts a run of the Studio `text-translation` (field kind `finding`, a versioned legal glossary) and reads it back. The Studio's
  contract is assumed from its issue (inputs `sourceLocale`, `targetLocales`, `fields`, `glossary`; output `translations`) and is checked
  when it merges; until then every test uses a fake port.
- **What is translated**: each finding's title and explanation, a review note, an authenticity signal's observation, hint and place.
  **What never is**: the quoted passage of the document (it stays in its language; its translation travels beside it as an
  « indicative translation », `quoteAid`), the law references, the rule ids, the verdicts, the dates and the amounts.
  Enforced twice: the references, amounts, dates, rule ids and any quoted passage inside a text are replaced by tokens before the text
  leaves and put back after (`lib/translation/protect.ts`); if a token does not come back exactly once the translation of that text is
  dropped and the original stays. The citation is not sent at all.
- **Traceability**: a translation keeps its Orazaka run id, the Studio version, the glossary version and the version (hash) of the
  source text. The signed payload carries `translation { original, language, runId, studioVersion, glossaryVersion, sourceVersion }`
  and the report prints which language is the original. The legal-review banner and the disclaimer exist in both languages.
- **Cached and charged once**: `report_translations` (migration 0027) per analysis, language, source version and glossary version. A
  report is translated once; changing the glossary or the text is a new translation. A failed run gives its credits back.
- **Admin**: `features.reportTranslation` (off until the Studio is live), `features.reportLanguages`, `limits.reportTranslationCredits`
  (0 = included), and the glossary (`translation_glossary`, versioned) by `GET/PUT /api/admin/translation-glossary`.
- **Reading**: `GET /api/documents/{id}/analyses/{analysisId}/translation?lang=` answers `running`, `done` (texts + trace) or `failed`;
  the report endpoints answer 409 `TRANSLATION_PENDING` until it is back, so a signed file is never a half translation.

## Consequences
- The signed PDF and HTML exist in each language with the same attestation mechanism.
- The pricebook as a separate concept does not exist in this repository: the credits per translation are a setting, to be fed from
  the pricebook when it lands.
- No admin screen for the glossary yet (API only).
