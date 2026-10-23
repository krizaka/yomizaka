"use client";

import { LogoutIcon, SettingsIcon } from "@krizaka/icons";
import { krizakaFetch, KrizakaQueryProvider, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { Button } from "@krizaka/ui/button";
import { ProductBarActions } from "@krizaka/ui/nav-bar";
import Link from "next/link";
import { z } from "zod";

import { type Locale, translator } from "@/lib/i18n";
import { signInPath } from "@/lib/nav";

/**
 * The public bar knows who is signed in (yomizaka#243) without the pages stopping being static: a small client island asks
 * `/api/me` (401 = signed out) and `/api/auth/sign-up/status`. What it learns only changes what the bar SHOWS — « Open the app »
 * and the avatar, or « Sign in » — never what anyone may do: the app and the API check the real session on every request.
 */
export const ME_KEY = ["me"] as const;
const meSchema = z.object({ account: z.object({ email: z.string(), name: z.string().nullable(), avatarSeed: z.string().nullable() }) });
export type Me = z.infer<typeof meSchema>["account"];

/** The person signed in, or null (no session, an expired one, or the server unreachable: the bar then says « Sign in »). */
export async function fetchMe(): Promise<Me | null> {
  try {
    return (await krizakaFetch("/api/me", { schema: meSchema })).account;
  } catch {
    return null;
  }
}

/** Signing out: the server ends the session, and whatever the bar remembered is dropped at once. */
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

/** What the bar's actions look like, from what is known; the container below only fetches. */
export function BarActionsView({ locale, placement, me, signupOpen, onSignOut }: { locale: Locale; placement: "bar" | "panel"; me: Me | null; signupOpen: boolean; onSignOut: () => void }) {
  const t = translator(locale);
  if (me) {
    const app = `/${locale}/app`;
    return (
      <>
        <Button asChild variant="primary" size={placement === "panel" ? "md" : "sm"} className={placement === "panel" ? "mt-2 w-full font-bold" : "ml-1 hidden font-bold md:inline-flex"}>
          <Link href={app}>{t("chrome.openApp")}</Link>
        </Button>
        {placement === "bar" ? (
          <AccountMenu
            label={t("chrome.account")}
            name={me.name ?? me.email}
            email={me.email}
            avatar={{ defaultAvatar: { brand: "yomizaka", seed: me.avatarSeed ?? me.email }, fallback: (me.name ?? me.email).charAt(0).toUpperCase() }}
            linkAs={Link}
            links={[{ id: "account", label: t("chrome.settings"), href: `${app}/settings`, icon: <SettingsIcon size={16} /> }]}
            signOut={{ label: t("chrome.signOut"), onSelect: onSignOut, icon: <LogoutIcon size={16} /> }}
          />
        ) : null}
      </>
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
  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 30_000, retry: false, throwOnError: false });
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
