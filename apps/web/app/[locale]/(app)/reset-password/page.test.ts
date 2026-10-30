import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

vi.mock("@/components/console/ResetPasswordForm", () => ({
  ResetPasswordForm: ({ token }: { token: string }) => `stub-form:${token.length}`,
}));

import ResetPasswordPage, { generateMetadata } from "./page";

const readable = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
const render = async (locale: "en" | "fr", token?: string) =>
  renderToStaticMarkup(
    await ResetPasswordPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ token }) }),
  );
const TOKEN = `ye1.${"A".repeat(43)}`;

describe("new password (the UX review's Y8)", () => {
  it("shows the form for a link of this product, in each language, and spends nothing by being opened", async () => {
    for (const [locale, m] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      const html = await render(locale, TOKEN);
      expect(html).toContain("stub-form:");
      expect(readable(html)).toContain(m.console.resetPassword.title);
    }
  });

  it.each([undefined, "", "garbage", `ay1.${"A".repeat(43)}`, `ye1.${"A".repeat(42)}`])(
    "shows the invalid page, with the way to a new link, for %s",
    async (token) => {
      for (const [locale, m] of [
        ["en", en],
        ["fr", fr],
      ] as const) {
        const html = await render(locale, token);
        expect(html).not.toContain("stub-form:");
        expect(readable(html)).toContain(m.console.resetPassword.invalid);
        expect(html).toContain(`href="/${locale}/forgot-password"`);
      }
    },
  );

  it("is never indexed and never leaks its link in a referrer", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: "en" }) })).toMatchObject({
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    });
  });
});
