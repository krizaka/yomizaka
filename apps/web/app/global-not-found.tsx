import "./globals.css";
import "@krizaka/ui/blocks.css";

import { ThemeProvider, ThemeScript } from "@krizaka/ui/theme";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { NotFoundView } from "@/components/not-found/NotFoundView";
import { localeFromHeader, NOT_FOUND_LOCALE_HEADER } from "@/lib/not-found-locale";

export const metadata: Metadata = { title: "404 · Yomizaka", robots: { index: false, follow: false } };

/**
 * The 404 of every address that matches no route (there is no root layout: the locale layout is the root). It bypasses the
 * layouts, so it carries its own document, its styles and its theme; the language comes from the proxy (see lib/not-found-locale.ts).
 */
export default async function GlobalNotFound() {
  const locale = localeFromHeader((await headers()).get(NOT_FOUND_LOCALE_HEADER));
  return (
    <html lang={locale} data-surface="product" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode="dark" />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased">
        <ThemeProvider defaultMode="dark">
          <main className="mx-auto flex min-h-screen items-center px-4 py-16">
            <NotFoundView locale={locale} />
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
