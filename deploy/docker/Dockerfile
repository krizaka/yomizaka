# Yomizaka web (Next.js standalone) — built by DigitalOcean App Platform from the repository root.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG APP_COMMIT_SHA=""
# The static pages (landing, privacy) bake the indexing flag at build: App Platform passes build variables as build args.
ARG APP_SEARCH_INDEXING=""
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA APP_SEARCH_INDEXING=$APP_SEARCH_INDEXING NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @yomizaka/web build
# The OCR (Tesseract) runs in a worker thread whose requires the build's tracing cannot see: carry its packages, with their
# trained data (French, English) and the few they need, whole and with their symlinks (ADR-0010). The smoke check proves it.
RUN mkdir /ocr && cd node_modules/.pnpm && cp -a $(ls | grep -E '^(tesseract\.js|tesseract\.js-core|bmp-js|idb-keyval|is-url|node-fetch|opencollective-postinstall|regenerator-runtime|wasm-feature-detect|zlibjs|tr46|whatwg-url|webidl-conversions)@|^@tesseract\.js-data\+') /ocr/

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
RUN addgroup -S yomizaka && adduser -S yomizaka -G yomizaka
# The runtime starts `node` only: npm and corepack (and the dependencies they bundle, flagged by the image scan) are not shipped.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=build --chown=yomizaka:yomizaka /repo/apps/web/.next/standalone ./
COPY --from=build --chown=yomizaka:yomizaka /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=yomizaka:yomizaka /ocr/ ./node_modules/.pnpm/
USER yomizaka
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
