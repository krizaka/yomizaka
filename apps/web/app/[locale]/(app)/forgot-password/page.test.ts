import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const state = vi.hoisted(() => ({ mail: true, minutes: 30 }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/access", () => ({ pageSession: async () => null }));
vi.mock("@/app/accounts-edge", () => ({ mailConfigured: () => state.mail }));
vi.mock("@/lib/password-reset", () => ({ resetLinkMinutes: async () => state.minutes }));
vi.mock("@/components/console/ForgotPasswordForm", () => ({
  ForgotPasswordForm: ({ minutes }: { minutes: number }) => `stub-form:${minutes}`,
}));

import ForgotPasswordPage from "./page";

const readable = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
const render = async (locale: "en" | "fr") =>
  renderToStaticMarkup(await ForgotPasswordPage({ params: Promise.resolve({ locale }) }));

describe("forgot password (the UX review's Y8)", () => {
  beforeEach(() => {
    state.mail = true;
    state.minutes = 30;
  });

  it("is on the sign-in frame — the owl large, the three proofs — in each language, with the way back", async () => {
    for (const [locale, m] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      const html = await render(locale);
      expect(html).toMatch(/width="160"/);
      expect(readable(html)).toContain(m.console.forgotPassword.title);
      expect(readable(html)).toContain(m.console.signIn.proofOne);
      expect(html).toContain(`href="/${locale}/sign-in"`);
    }
  });

  it("gives the form the lifetime the setting says, so the page and the mail agree", async () => {
    state.minutes = 90;
    expect(await render("en")).toContain("stub-form:90");
  });

  it("says a link cannot be sent while e-mail is off, and shows no form", async () => {
    state.mail = false;
    const html = await render("fr");
    expect(readable(html)).toContain(fr.console.forgotPassword.mailOff);
    expect(html).not.toContain("stub-form:");
  });
});

describe("the messages of the flow", () => {
  it("say the lifetime as a variable, never a number typed in the words", () => {
    for (const m of [en, fr]) expect(m.console.forgotPassword.sent).toContain("{minutes}");
    for (const m of [en, fr]) expect(JSON.stringify(m.console.forgotPassword)).not.toMatch(/\b30\b/);
  });
});
