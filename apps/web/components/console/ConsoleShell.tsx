"use client";

import { HomeIcon, LogoutIcon, PlusIcon, SearchIcon, SettingsIcon, ShieldIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { YomizakaLogo } from "@krizaka/ui";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { AppHeader } from "@krizaka/ui/app-header";
import { languagesFor, LanguageSwitch } from "@krizaka/ui/language-switch";
import { RailNav } from "@krizaka/ui/rail-nav";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { activeNav, CONSOLE_ROUTES, titleOf, withoutLocale } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";

const BUILD = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const ADMIN_URL = "https://admin.yomizaka.com";

/**
 * The frame of the signed-in space, on the Krizaka family's model (Orochia): `RailNav` — a column of icons on a desktop that
 * widens to words, the bottom tab bar on a phone — with `AppHeader` (the page's title and its actions) and the `AccountMenu`.
 * The active entry comes from the route (lib/console-nav.ts), never from local state; each destination exists once.
 */
export function ConsoleShell({ locale, email, name, role, children }: { locale: "en" | "fr"; email: string; name?: string; role: "USER" | "ADMIN"; children: React.ReactNode }) {
  const { say } = useSay();
  const router = useRouter();
  const path = usePathname() ?? "";
  const active = activeNav(path);
  const rest = withoutLocale(path);
  const href = (to: string) => `/${locale}${to}`;
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => {
      router.replace(`/${locale}/sign-in`);
      router.refresh();
    },
  });
  return (
    <RailNav.Shell>
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-sm focus:bg-surface-1 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold">
        {say("shell.skip")}
      </a>
      <RailNav.Root
        label={say("shell.sidebarLabel")}
        accent="yomizaka"
        expandable
        expandLabels={[say("shell.expand"), say("shell.collapse")]}
        mark={
          <Link href={href(CONSOLE_ROUTES.library)} aria-label="Yomizaka" title={BUILD ? `Yomizaka · ${say("shell.devBuild", { version: BUILD })}` : "Yomizaka"}>
            <YomizakaLogo size={28} animated={false} />
          </Link>
        }
        footer={
          <>
            <RailNav.Item asChild icon={<SettingsIcon size={22} />} label={say("shell.account")} current={active === "account"}>
              <Link href={href(CONSOLE_ROUTES.account)} />
            </RailNav.Item>
            {role === "ADMIN" ? (
              <RailNav.Item asChild icon={<ShieldIcon size={22} />} label={say("shell.admin")}>
                <a href={ADMIN_URL} />
              </RailNav.Item>
            ) : null}
          </>
        }
      >
        <RailNav.Item asChild icon={<HomeIcon size={22} />} label={say("shell.library")} current={active === "library"}>
          <Link href={href(CONSOLE_ROUTES.library)} />
        </RailNav.Item>
        <RailNav.Item asChild icon={<PlusIcon size={22} />} label={say("shell.check")} current={active === "check"}>
          <Link href={href(CONSOLE_ROUTES.check)} />
        </RailNav.Item>
        <RailNav.Item asChild icon={<SearchIcon size={22} />} label={say("shell.search")} current={active === "search"}>
          <Link href={href(CONSOLE_ROUTES.search)} />
        </RailNav.Item>
      </RailNav.Root>
      <RailNav.Body className="min-w-0 flex-1">
        <AppHeader
          name={say(`shell.titles.${titleOf(path)}`)}
          mark={<YomizakaLogo size={26} animated={false} />}
          homeLink={<Link href={href(CONSOLE_ROUTES.library)} aria-label="Yomizaka" />}
          actions={
            <>
              <LanguageSwitch label={say("shell.language")} current={locale} languages={languagesFor(`/${locale}${rest}`)} linkAs={Link} />
              <ThemeToggle label={say("shell.theme")} variant="ghost" />
              <AccountMenu
                label={say("shell.account")}
                name={name ?? email}
                email={email}
                showName
                avatar={{ defaultAvatar: { brand: "yomizaka", seed: email }, fallback: (name ?? email).charAt(0).toUpperCase() }}
                linkAs={Link}
                links={[{ id: "account", label: say("shell.account"), href: href(CONSOLE_ROUTES.account), icon: <SettingsIcon size={16} /> }]}
                signOut={{ label: say("shell.signOut"), onSelect: () => signOut.mutate(), icon: <LogoutIcon size={16} /> }}
              >
                {BUILD ? (
                  <p className="px-3 py-1 text-xs text-fg-muted" data-testid="app-version">
                    {say("shell.devBuild", { version: BUILD })}
                  </p>
                ) : null}
              </AccountMenu>
            </>
          }
        />
        <main id="content" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6">
          {children}
        </main>
      </RailNav.Body>
    </RailNav.Shell>
  );
}
