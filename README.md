<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/yomizaka-dark.svg">
    <img src=".github/assets/yomizaka-light.svg" alt="Yomizaka" width="96">
  </picture>
</p>

# Yomizaka

**Read before you sign.** Drop a lease, a contract, an invoice: Orazaka reads it against the law, examines the PDF for
signs of editing, and shows you every line it relies on. Keep your documents, find any clause again in a second — and
know exactly which run produced each finding.

[![CI](https://github.com/krizaka/yomizaka/actions/workflows/ci.yml/badge.svg)](https://github.com/krizaka/yomizaka/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![dev.yomizaka.com](https://img.shields.io/badge/dev.yomizaka.com-Yomizaka-3c38b2)](https://dev.yomizaka.com)

Yomizaka (読み *yomi*, reading) is a Krizaka product in development: **sign-up is closed**, the dev site shows what it does
and a real run.

## What it does

- **Library** — upload PDFs or text files (a queue that pauses, resumes and retries); each is kept as sent, its text
  layer read for search, its SHA-256 recorded; a file sent twice is one document.
- **Against the law** — a lease checked rule by rule against the rules of its jurisdiction (France, Wallonia) in force
  on a date: each finding gives its rule, severity, verdict, citation and the exact passage, highlighted in the text.
- **Signs of editing** — a supplier's PDF examined as a file (producer, dates, successive saves, fonts): signals at three
  plain levels, never a score, never a "fake" stamp.
- **Search** — every document and every finding, one field (PostgreSQL full text, French and English alike).
- **Traced** — every analysis is an **Orazaka run** (the document-validation pack's Studios); its run id is kept and shown.
  Yomizaka never calls a model.

## Start

```bash
corepack enable && pnpm install          # Node 22, pnpm 10 — also installs the pre-push hook
cp .env.example .env                       # a local PostgreSQL URL; AI_API_KEY to run analyses
pnpm dev                                   # http://localhost:3000
pnpm run check                             # lint · typecheck · tests (what the hook and CI run)
```

## Inside

| Path | |
| :-- | :-- |
| `apps/web` | Next.js 16: the public page, sign-in (`@krizaka/ui/auth-layout`), the console (`AppShell`), the BFF (`app/api`) |
| `packages/core` | zod contracts, query keys, the report readers — shared by the API and the web |
| `scripts/check-seo-family.mjs` | the Krizaka family SEO guard, run in CI on the built site |
| `deploy/` | the Docker image and the DigitalOcean App Platform spec (`dev.yomizaka.com`) |

Rules for contributors and agents: [AGENTS.md](AGENTS.md). Security: [SECURITY.md](SECURITY.md).

---

A [Krizaka](https://www.krizaka.com) product · Made in Montréal · Apache-2.0
