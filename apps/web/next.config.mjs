import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
// package.json's version + the short commit DigitalOcean passes at build (APP_COMMIT_SHA): the version every page shows.
const appVersion = process.env.APP_VERSION?.trim() || (process.env.APP_COMMIT_SHA ? `${packageVersion}+${process.env.APP_COMMIT_SHA.slice(0, 7)}` : packageVersion);
const production = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: nothing but this origin — no third-party script, frame or font. One exception, for images and
 * media only: the Krizaka media CDN (the owl's loop of the landing, lib/owl-loop.ts). The document viewer frames
 * the document's own file (`/api/documents/<id>/file`, same origin), so frames are 'self' and nothing else. Next renders
 * inline bootstrap scripts without a nonce, so scripts keep 'unsafe-inline'. Development adds what the dev server needs.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://krizaka-assets.b-cdn.net",
  "media-src 'self' https://krizaka-assets.b-cdn.net",
  "font-src 'self' data:",
  `connect-src 'self'${production ? "" : " ws: http://localhost:* http://127.0.0.1:*"}`,
  "frame-src 'self'",
  "object-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // The monorepo root: the standalone server then carries @yomizaka/core and the hoisted dependencies.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  transpilePackages: ["@yomizaka/core"],
  // The pool and the PDF reader stay Node modules, required at run time.
  serverExternalPackages: ["pg", "unpdf"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
