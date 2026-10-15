# Yomizaka — agent contract

> Governance of **`krizaka/yomizaka`**: Yomizaka, a Krizaka product — documents (leases, contracts, invoices) kept,
> read, checked and searched. **Every analysis is an Orazaka run.** Agent-neutral: humans and AI agents follow the same rules.

## 1. What this repository is

- A **pnpm + Turborepo** monorepo: `apps/web` (Next.js 16: the public page, sign-in, the console and the BFF — route
  handlers are the only HTTP surface) and `packages/core` (zod contracts the API answers with and the web reads, the
  query keys, the pure helpers). One product = one repository (`krizaka/<product>`).
- **Built only from Krizaka bricks**: `@krizaka/ui` (auth-layout, app-shell, product-page, data-table, form, file-upload
  with its pacer queue, search-field, tabs…), `@krizaka/query`, `@krizaka/i18n`, `@krizaka/icons`, `@krizaka/tokens`
  (`brands/yomizaka.css`). A missing generic component is added to krizaka-ui, released, then used — never copied here.
  No `@tanstack/*` import (only through `@krizaka/*`), no `fetch` in a client `useEffect` (Server Components and
  `@krizaka/query`), no hand-written `<table>` or multi-field `<form>`.

## 2. Orazaka does the analysis — never this repository

- Yomizaka **never calls a model** and never judges a document itself. Compliance (a lease against a jurisdiction's
  rules) and authenticity (a PDF examined as a file) are the Studios of Orazaka's `document-validation` pack, called on
  `AI_API_URL` (`https://dev.orazaka.com/edge`) with the service key `AI_API_KEY` (`oz_…`, created by Orazaka's
  `node scripts/dev-deploy.mjs service-account yomizaka --studios compliance-check,document-authenticity --out …`, stored
  in DigitalOcean as a SECRET). `lib/orazaka.ts` is the only client.
- **Every analysis keeps its Orazaka run id**, shown in the UI: the trace of what ran, on which Studio version.
- Reading a file's **text layer** (pdf.js through `unpdf`) is parsing, not analysis: it feeds the compliance Studio and
  search. A scanned PDF has no text layer — the UI says so; reading images would be Orazaka's job.
- A report is shown as Orazaka returned it (`packages/core` `reportOf`): a shape it did not send is `null`, never a guess.
  Claims on the public page ("a real run") only from a run that really happened on dev (`lib/demo-run.ts`).

## 3. The product is independent

- No link to another Krizaka product, no family switcher, no family columns in the footer. Krizaka is the publisher,
  named **only in the footer** ("A Krizaka product" → www.krizaka.com) and the legal mentions. Orazaka is named as the
  engine in words (it is the point), never as a link.
- The colour is the Yomizaka brand of `@krizaka/tokens` (ink indigo), the mark `YomizakaLogo`, the bird the owl ("reads
  and knows every face"). Components use `--kz-*` roles only; dark and light are first-class (dark by default).

## 4. Security of the dev environment

- **Sign-up is closed server-side** (`AUTH_SIGNUP_ENABLED` is not `true` → `/api/auth/sign-up` answers 403). Only the
  QA accounts of `company/QA.md` exist (`apps/web/scripts/qa-accounts.mjs`, passwords from the environment, never printed).
- The administration (`/app/admin/*`, `/api/admin/*`) needs a session, the ADMIN role **and** an address of
  `AUTH_ALLOWED_IPS` (empty in production = nobody); a failed lock is a 404 on pages, a 403 on the API.
- Passwords: scrypt; sessions: random tokens kept as keyed hashes (`AUTH_SESSION_SECRET`), HttpOnly cookies; rate limits
  on sign-in, upload, analysis and search; security headers (CSP same-origin, HSTS, nosniff, frame-ancestors self).
- A production server refuses to start without `DATABASE_URL`, `AUTH_SESSION_SECRET` (≥ 32), an `oz_` key and, for a TLS
  database, its CA (`lib/env.ts`). Secrets only in DO as SECRET and in the maintainer's local files — never in the
  repository, never printed (read them with `~/.krizaka-worktrees/tools/secret.sh`).
- Environment variables are named by bounded context (`APP_`, `DATABASE_`, `AUTH_`, `ABUSE_`, `AI_`), never by product or
  vendor; each is declared once in `apps/web/lib/env.ts`.

## 5. Storage and cost

- Documents (≤ 10 MB) are kept **in the database** (`documents.content`, bytea) for the MVP: no storage service to pay
  for or secure. Database `yomizaka_db` on the shared dev cluster `krizaka-dev-pg` (its own role, trusted source = the
  app). Migrations are code (`lib/migrations.ts`), applied at start under an advisory lock; a deployed migration is never
  edited.
- Deployed on DigitalOcean App Platform, project `yomizaka`, the smallest service (`apps-s-1vcpu-0.5gb`, $5/month),
  `dev.yomizaka.com`. Budget mode: nothing recurring above that without a written decision.

## 6. Checks — local first, CI always

- **Before every push**, the local check: `pnpm run check` (lint · typecheck · tests). The pre-push hook
  (`.githooks/pre-push`, installed by `pnpm install`) runs it; never push "to see what CI says".
- CI (`.github/workflows/ci.yml`): lint (ESLint, i18n catalogues), typecheck, unit tests, production build, the SEO family
  guard on the built site, and CodeQL. Never merge with a pending or red check.
- **No test, not done**: every feature and every fix ships with its tests (a fix starts with a failing test). Pure logic
  lives where a test reaches it (`packages/core`, `apps/web/lib`).
- Every visible page is checked in dark and light, desktop and phone, before it is announced. PR captures go to Bunny
  (`pr-assets/yomizaka/…`, krizaka-com `scripts/pr-assets.mjs`), never into the repository.
- Each notable UX choice has its entry in `docs/UX_DECISIONS.md`.

## 7. Text

- Every user-facing string is in `apps/web/messages/{en,fr}.json` (English is the reference; `krizaka-i18n check` in
  `pnpm lint`). Never choose a text with a locale ternary. Orazaka's reports are in French, the language of their rules:
  the UI says so.
