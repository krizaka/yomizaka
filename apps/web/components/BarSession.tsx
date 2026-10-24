"use client";

import { HomeIcon, LogoutIcon, SettingsIcon } from "@krizaka/icons";
import { krizakaFetch, KrizakaQueryProvider, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { Button } from "@krizaka/ui/button";
import { ProductBarActions } from "@krizaka/ui/nav-bar";
import Link from "next/link";
import { z } from "zod";

import { type Locale, translator } from "@/lib/i18n";
import { signInPath } from "@/lib/nav";

/**
 * The public site knows who is signed in (yomizaka#243) without the pages stopping being static: a small client island asks
 * `/api/me` (401 = signed out) and `/api/auth/sign-up/status`. What it learns only changes what the page SHOWS — the bar's
 * account and the hero's action — never what anyone may do: the app and the API check the real session on every request.
 * The bar and the hero read the same answer (one `BarQueryRoot` around the page), so they never disagree (the review's F0).
 */
export const ME_KEY = ["me"] as const;
const meSchema = z.object({ account: z.object({ email: z.string(), name: z.string().nullable(), avatarSeed: z.string().nullable() }) });
export type Me = z.infer<typeof meSchema>["account"];

/** The person signed in, or null (no session, an expired one, or the server unreachable: the page then says « Sign in »). */
export async function fetchMe(): Promise<Me | null> {
  try {
    return (await krizakaFetch("/api/me", { schema: meSchema })).account;
  } catch {
    return null;
  }
}

/** Signing out: the server ends the session, and whatever the page remembered is dropped at once. */
export async function signOutAndForget(client: { setQueryData: (key: readonly string[], value: null) => void }, post: () => Promise<unknown>): Promise<void> {
  try {
    await post();
  } finally {
    client.setQueryData(ME_KEY, null);
  }
}

export function BarQueryRoot({ children }: { children: React.ReactNode }) {
  return <KrizakaQueryProvider>{children}</KrizakaQueryProvider>;
}

const useMe = () => useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 30_000, retry: false, throwOnError: false });

/**
 * What the bar's actions look like, from what is known; the container below only fetches. Signed in, the bar keeps a quiet
 * account entry — the avatar and the name when there is one, never the raw e-mail address — and the hero carries the one
 * primary action, « Ouvrir mes documents »; the mobile panel, a drawer, says it in full.
 */
export function BarActionsView({ locale, placement, me, signupOpen, onSignOut }: { locale: Locale; placement: "bar" | "panel"; me: Me | null; signupOpen: boolean; onSignOut: () => void }) {
  const t = translator(locale);
  if (me) {
    const app = `/${locale}/app`;
    if (placement === "panel") {
      return (
        <Button asChild variant="primary" size="md" shape="cut" className="mt-2 w-full font-bold">
          <Link href={app}>{t("chrome.openApp")}</Link>
        </Button>
      );
    }
    return (
      <AccountMenu
        label={t("chrome.account")}
        name={me.name ?? undefined}
        email={me.email}
        showName={Boolean(me.name)}
        avatar={{ defaultAvatar: { brand: "yomizaka", seed: me.avatarSeed ?? me.email }, fallback: (me.name ?? me.email).charAt(0).toUpperCase() }}
        linkAs={Link}
        links={[
          { id: "documents", label: t("chrome.myDocuments"), href: app, icon: <HomeIcon size={16} /> },
          { id: "account", label: t("chrome.settings"), href: `${app}/settings`, icon: <SettingsIcon size={16} /> },
        ]}
        signOut={{ label: t("chrome.signOut"), onSelect: onSignOut, icon: <LogoutIcon size={16} /> }}
      />
    );
  }
  return (
    <ProductBarActions
      placement={placement}
      linkAs={Link}
      signupOpen={signupOpen}
      signIn={{ href: signInPath(locale), label: t("chrome.signIn") }}
      tryIt={{ href: `/${locale}/sign-up`, label: t("chrome.tryIt") }}
    />
  );
}

const signupStatus = z.object({ open: z.boolean() });

export function BarActions({ locale, placement }: { locale: Locale; placement: "bar" | "panel" }) {
  const client = useQueryClient();
  const me = useMe();
  const signup = useQuery({
    queryKey: ["signup-status"],
    queryFn: () => krizakaFetch("/api/auth/sign-up/status", { schema: signupStatus }).then((r) => r.open, () => false),
    staleTime: 60_000,
    retry: false,
    throwOnError: false,
  });
  const signOut = useMutation({ mutationFn: () => signOutAndForget(client, () => krizakaFetch("/api/auth/sign-out", { method: "POST" })) });
  return <BarActionsView locale={locale} placement={placement} me={me.data ?? null} signupOpen={signup.data ?? false} onSignOut={() => signOut.mutate()} />;
}

/**
 * The hero's action, from the same answer as the bar (the review's F0): « Ouvrir mes documents » to the library once signed
 * in, « Se connecter » with the product's status line otherwise. Rendered on the server as signed out — the page is static —
 * and swapped as soon as the island knows; the two never say different things, they read one query.
 */
export function HeroActionsView({ locale, me, status }: { locale: Locale; me: Me | null; status: string }) {
  const t = translator(locale);
  if (me) {
    return (
      <div className="flex flex-wrap items-center gap-3" data-testid="hero-actions" data-session="in">
        <Button asChild variant="primary" size="lg" shape="cut">
          <Link href={`/${locale}/app`}>{t("landing.openApp")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3" data-testid="hero-actions" data-session="out">
        <Button asChild variant="primary" size="lg" shape="cut">
          <Link href={signInPath(locale)}>{t("landing.signIn")}</Link>
        </Button>
      </div>
      <p className="mt-4 max-w-[60ch] text-sm text-fg-secondary" data-testid="hero-status">
        {status}
      </p>
    </>
  );
}

export function HeroActions({ locale, status }: { locale: Locale; status: string }) {
  const me = useMe();
  return <HeroActionsView locale={locale} me={me.data ?? null} status={status} />;
}

/** The closing call's action — secondary, the hero's island keeps the one primary: signed in, the documents; signed out, the way in. */
export function ClosingActionsView({ locale, me }: { locale: Locale; me: Me | null }) {
  const t = translator(locale);
  return (
    <Button asChild variant="secondary" size="lg" shape="cut" data-testid="closing-action" data-session={me ? "in" : "out"}>
      <Link href={me ? `/${locale}/app` : signInPath(locale)}>{me ? t("landing.openApp") : t("landing.signIn")}</Link>
    </Button>
  );
}

export function ClosingActions({ locale }: { locale: Locale }) {
  const me = useMe();
  return <ClosingActionsView locale={locale} me={me.data ?? null} />;
}

/** The closing call's sentence, by session: never « sign in » to someone who is. */
export function ClosingBodyView({ me, signedOut, signedIn }: { me: Me | null; signedOut: string; signedIn: string }) {
  return <span data-testid="closing-body">{me ? signedIn : signedOut}</span>;
}

export function ClosingBody({ signedOut, signedIn }: { signedOut: string; signedIn: string }) {
  const me = useMe();
  return <ClosingBodyView me={me.data ?? null} signedOut={signedOut} signedIn={signedIn} />;
}
