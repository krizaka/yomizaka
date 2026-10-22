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
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/krizaka/yomizaka/badge)](https://scorecard.dev/viewer/?uri=github.com/krizaka/yomizaka)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![dev.yomizaka.com](https://img.shields.io/badge/dev.yomizaka.com-Yomizaka-3c38b2)](https://dev.yomizaka.com)

Yomizaka (読み *yomi*, reading) is a Krizaka product in development: **sign-up is closed**, the dev site shows what it does
and a real run. It has no mobile app: the Dev preview is **web only** (phone-first), mobile comes later.

## What it does

- **Library** — upload PDFs or text files (a queue that pauses, resumes and retries); each is kept as sent, its text
  layer read for search, its SHA-256 recorded; a file sent twice is one document.
- **Against the law** — a lease checked rule by rule against the rules of its jurisdiction (Québec, France, Wallonia) in force
  on a date: each finding gives its rule, severity, verdict, citation and the exact passage, highlighted in the text.
- **Signs of editing** — a PDF examined as a file (producer, dates, successive saves, fonts): signals at three
  plain levels, never a score, never a "fake" stamp.
- **Search** — every document and every finding, one field (PostgreSQL full text, French and English alike).
- **Traced** — every analysis is an **Orazaka run** (the document-validation pack's Studios); its run id is kept and shown.
  Yomizaka never calls a model.
- **A signed report** — a finished check exports a report as HTML and as a signed PDF (a visible signature page, an Ed25519
  attestation); only a signed-in member the owner gave access to can verify it (`/verify`, ADR-0002). A specimen is never signed.
- **Who it is for** — a « Pour qui ? » picker (tenant, landlord, freelancer, business, other). The tenant and the landlord have
  lease rules, the freelancer and the business have the Québec invoice check (8 rules from the federal regulation on input tax credit
  information: date, total, GST and QST numbers, taxes, payment terms); contracts say « soon » and promise nothing (`docs/product/direction-2026-10.md`). The flows behind them are
  data, administered in the database (ADR-0003).
- **Checking a tenant's application** — a consent-first flow with a provider-agnostic seam; only a demo provider answers, on dev,
  with fictitious data. No real provider is contracted yet.
- **A short public site** — the home (who it is for, one real check recorded, sign-in), sign-in and the privacy notice; nothing else is public (`docs/UX_DECISIONS.md` § 9).

The administration is **admin.yomizaka.com** (the same app, routed by host): people, documents, Orazaka runs, flows, operations
and an audit log of every operator action. It answers only addresses of `AUTH_ALLOWED_IPS` and an administrator's session, and is never indexed.

## Next

Yomizaka will also check **identity documents** (photos and scans as well as PDFs) for other Krizaka products that need a
document verified before an account can be opened — served by API, analysed through Orazaka, every finding recorded with
its evidence, and a human decides anything unclear. This is not built yet: it is tracked in
[#7](https://github.com/krizaka/yomizaka/issues/7).

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
| `scripts/check-overflow.mjs` | the responsive crawl (dark and light, 360–1440 px, no console error), run in CI |
| `scripts/check-admin-live.mjs` | the walk of the live administration from an allowed address (`pnpm run check:admin-live`) |
| `deploy/` | the Docker image and the DigitalOcean App Platform spec (`dev.yomizaka.com`) |

## Environment

Every variable is declared once in `apps/web/lib/env.ts` (see `.env.example`); a test keeps this table in sync.

| Variable | Meaning |
| :-- | :-- |
| `APP_ENVIRONMENT` | `dev` or `prod`: which flows are enabled |
| `APP_PUBLIC_URL` | the public address (www.yomizaka.com: canonical links, indexed) |
| `APP_DEV_HOST` | the development address (dev.yomizaka.com): pages go to www with a 308, the API and /.well-known keep serving, noindex |
| `APP_SEARCH_INDEXING` | `on` or `off`: `off` answers noindex everywhere |
| `APP_REPORT_SIGNING_KEY` | the Ed25519 key that signs reports |
| `DATABASE_URL`, `DATABASE_CA_CERT` | PostgreSQL and its CA |
| `AUTH_SESSION_SECRET` | keys the session hashes (≥ 32 characters in production) |
| `AUTH_SIGNUP_ENABLED` | sign-up is closed unless `true` **and** the verification e-mail can be sent (the `MAIL_` variables below) |
| `MAIL_PROVIDER` | the e-mail vendor, as a value (`mailgun`) |
| `MAIL_API_KEY` | the vendor's key (a secret) |
| `MAIL_DOMAIN` | the sending domain |
| `MAIL_API_URL` | the vendor's API address (default `https://api.mailgun.net`) |
| `MAIL_FROM` | the sender (default `Yomizaka <no-reply@MAIL_DOMAIN>`) |
| `AUTH_ALLOWED_IPS` | the addresses of the administration (empty in production = nobody) |
| `ABUSE_CLIENT_IP_HEADER`, `ABUSE_TRUSTED_PROXY_HOPS` | where the client address is read |
| `AI_PROVIDER`, `AI_API_URL`, `AI_API_KEY` | Orazaka's edge and the service key (`oz_…`) |

Rules for contributors and agents: [AGENTS.md](AGENTS.md). Security: [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE) © Krizaka

---

A [Krizaka](https://www.krizaka.com) product · Made in Montréal · Apache-2.0
