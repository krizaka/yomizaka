import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const state = vi.hoisted(() => ({ open: false }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/access", () => ({ pageSession: async () => null }));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));
vi.mock("@/lib/settings/signup", () => ({ signupOpenNow: async () => state.open }));
vi.mock("@/components/console/SignInForm", () => ({ SignInForm: () => null }));

import SignInPage from "./page";

const MESSAGES = { en, fr } as const;
type Locale = keyof typeof MESSAGES;

const render = async (locale: Locale, query: { verified?: string; verify?: string } = {}) =>
  renderToStaticMarkup(await SignInPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }));

const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("sign-in (the UX review's Y8)", () => {
  beforeEach(() => {
    state.open = false;
  });

  it("draws the owl large (160 px) and the three proofs in the brand panel, in each language", async () => {
    for (const locale of ["fr", "en"] as const) {
      const html = await render(locale);
      expect(html).toMatch(/width="160"/);
      const text = readable(html);
      for (const key of ["proofOne", "proofTwo", "proofThree"] as const) {
        expect(text).toContain(MESSAGES[locale].console.signIn[key]);
      }
    }
  });

  it("says sign-up is closed when the setting is off, and offers the account link only when it is open", async () => {
    state.open = false;
    const closed = readable(await render("fr"));
    expect(closed).toContain(fr.console.signIn.closedTitle);
    expect(closed).toContain(fr.console.signIn.closed);
    expect(closed).not.toContain(fr.console.signIn.signUpLink);

    state.open = true;
    const open = readable(await render("fr"));
    expect(open).toContain(fr.console.signIn.signUpLink);
    expect(open).not.toContain(fr.console.signIn.closedTitle);
  });

  it("shows the confirmation notice, or the error notice for an invalid or expired link", async () => {
    const ok = readable(await render("en", { verified: "1" }));
    expect(ok).toContain(en.console.signIn.verifiedNotice);
    expect(ok).not.toContain(en.console.signIn.invalidNotice);

    const bad = readable(await render("en", { verify: "1" }));
    expect(bad).toContain(en.console.signIn.invalidNotice);
    expect(bad).not.toContain(en.console.signIn.verifiedNotice);
  });
});
