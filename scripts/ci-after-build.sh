#!/usr/bin/env bash
# Runs after the production build (the org's node-ci `after-build`; the repository root is the working directory):
# the SEO family contract on the built site, the responsive guard in a real browser, sign-up closed.
set -euo pipefail
export NODE_ENV=production
export AUTH_SESSION_SECRET=ci-only-session-secret-0123456789abcdef
export AI_API_KEY=oz_ci_only_not_a_key
export PORT=3000
# A throwaway signing key for this run only (a production server refuses to start without one).
APP_REPORT_SIGNING_KEY="$(node -e 'process.stdout.write(require("crypto").generateKeyPairSync("ed25519").privateKey.export({type:"pkcs8",format:"der"}).toString("base64"))')"
export APP_REPORT_SIGNING_KEY
trap 'tail -100 web.log || true' ERR
(cd apps/web && npx next start -p 3000 > ../../web.log 2>&1 &)
for _ in $(seq 1 60); do curl -sf http://localhost:3000/api/healthz && break; sleep 1; done
pnpm run seo:check
# Responsive guard: no horizontal overflow at 360-1440 px in both themes, chips of at least 44 px.
pnpm run check:overflow -- --base http://localhost:3000
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-up)" = "403"
