import { ThemeProvider } from "@krizaka/ui/theme";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const krizakaFetch = vi.fn();
vi.mock("@krizaka/query", async (original) => ({ ...(await original<typeof import("@krizaka/query")>()), krizakaFetch: (...args: unknown[]) => krizakaFetch(...args) }));

import { BarActionsView, fetchMe, type Me, ME_KEY, signOutAndForget } from "./BarSession";
import { SiteHeader } from "./SiteChrome";

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const ME: Me = { email: "eric@example.test", name: "Éric", avatarSeed: null };
const view = (props: Partial<Parameters<typeof BarActionsView>[0]> = {}) => renderToStaticMarkup(<BarActionsView locale="en" placement="bar" me={null} signupOpen={false} onSignOut={() => {}} {...props} />);

beforeEach(() => {
  krizakaFetch.mockReset();
});

describe("the public bar knows who is signed in (yomizaka#243)", () => {
  it("signed in: « Open the app » to the app, and the account (avatar, name) — no « Sign in »", () => {
    const html = view({ me: ME });
    expect(text(html)).toContain("Open the app");
    expect(html).toContain('href="/en/app"');
    expect(html).toContain('aria-label="Account"');
    expect(text(html)).not.toContain("Sign in");
    expect(text(view({ me: ME, locale: "fr" }))).toContain("Ouvrir l'app");
  });

  it("signed out: « Sign in » while sign-up is closed; « Try Yomizaka » first, then « Sign in », once it is open", () => {
    expect(text(view())).toContain("Sign in");
    expect(text(view())).not.toContain("Try Yomizaka");
    const open = view({ signupOpen: true });
    expect(text(open)).toContain("Try Yomizaka");
    expect(text(open)).toContain("Sign in");
    expect(open).toContain('href="/en/sign-up"');
    expect(text(view({ locale: "fr" }))).toContain("Se connecter");
  });

  it("the mobile panel has the same words, full width, and no account menu", () => {
    expect(text(view({ placement: "panel", me: ME }))).toContain("Open the app");
    expect(view({ placement: "panel", me: ME })).not.toContain('aria-label="Account"');
    expect(text(view({ placement: "panel" }))).toContain("Sign in");
  });

  it("the bar of every public page says no « Talk to us », in either language", () => {
    for (const locale of ["en", "fr"] as const) {
      const html = text(renderToStaticMarkup(
          <ThemeProvider>
            <SiteHeader locale={locale} current="home" />
          </ThemeProvider>,
        ));
      expect(html).not.toMatch(/Talk to us|Nous parler|Contact us/);
    }
  });
});

describe("the hint comes from the server, never from the browser's memory", () => {
  it("reads the identity from /api/me", async () => {
    krizakaFetch.mockResolvedValue({ account: ME });
    expect(await fetchMe()).toEqual(ME);
    expect(krizakaFetch.mock.calls[0]![0]).toBe("/api/me");
  });

  it("no session (401), an expired one or an unreachable server: signed out", async () => {
    krizakaFetch.mockImplementation(async () => {
      throw Object.assign(new Error("Sign in first"), { status: 401 });
    });
    expect(await fetchMe()).toBeNull();
    krizakaFetch.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchMe()).toBeNull();
  });

  it("signing out forgets the person at once — even when the call fails", async () => {
    const cache = new Map<string, unknown>([[ME_KEY.join(), ME]]);
    const client = { setQueryData: (key: readonly string[], value: null) => void cache.set(key.join(), value) };
    await signOutAndForget(client, async () => undefined);
    expect(cache.get("me")).toBeNull();
    cache.set("me", ME);
    await expect(signOutAndForget(client, async () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(cache.get("me")).toBeNull();
  });
});
