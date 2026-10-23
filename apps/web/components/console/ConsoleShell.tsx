"use client";

import { CheckIcon, HomeIcon, LogoutIcon, PlusIcon, SearchIcon, SettingsIcon, ShieldIcon, UserIcon, WalletIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { YomizakaLogo } from "@krizaka/ui";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { AppHeader } from "@krizaka/ui/app-header";
import { languagesFor } from "@krizaka/ui/language-switch";
import { RailNav } from "@krizaka/ui/rail-nav";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { activeNav, CONSOLE_ROUTES, titleOf, withoutLocale } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";

const BUILD = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const ADMIN_URL = "https://admin.yomizaka.com";

/**
 * The frame of the signed-in space, on the Krizaka family's model (Orochia): `RailNav` — a column of icons on a desktop that
 * widens to words, the bottom tab bar on a phone — with `AppHeader` (the page's title and its actions) and the `AccountMenu`.
 * The active entry comes from the route (lib/console-nav.ts), never from local state; each destination exists once.
 */
export function ConsoleShell({ locale, email, name, avatarSeed, role, children }: { locale: "en" | "fr"; email: string; name?: string; avatarSeed?: string; role: "USER" | "ADMIN"; children: React.ReactNode }) {
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
  // The signed-in person is always visible (yomizaka#243): the header's account menu, on every width — avatar, name and e-mail,
  // settings, theme, language, sign out. (The rail's footer would add an empty column to the phone's tab bar: see the PR.)
  const languages = languagesFor(`/${locale}${rest}`);
  const account = () => (
    <span className="flex">
      <AccountMenu
        label={say("shell.account")}
        name={name ?? email}
        email={email}
        showName
        avatar={{ defaultAvatar: { brand: "yomizaka", seed: avatarSeed ?? email }, fallback: (name ?? email).charAt(0).toUpperCase() }}
        linkAs={Link}
        links={[
          { id: "profile", label: say("shell.profile"), href: href(`${CONSOLE_ROUTES.account}/profil`), icon: <UserIcon size={16} /> },
          { id: "settings", label: say("shell.settings"), href: href(`${CONSOLE_ROUTES.account}/securite`), icon: <SettingsIcon size={16} /> },
          { id: "billing", label: say("shell.billing"), href: href(`${CONSOLE_ROUTES.account}/facturation`), icon: <WalletIcon size={16} /> },
          ...(role === "ADMIN" ? [{ id: "admin", label: say("shell.admin"), href: ADMIN_URL, icon: <ShieldIcon size={16} /> }] : []),
        ]}
        language={{ label: say("shell.language"), value: locale, options: languages.map((l) => ({ value: l.code, label: l.name })), onChange: (to) => router.push(languages.find((l) => l.code === to)?.href ?? `/${to}${rest}`) }}
        signOut={{ label: say("shell.signOut"), onSelect: () => signOut.mutate(), icon: <LogoutIcon size={16} /> }}
      >
        <div className="px-3 py-1">
          <ThemeToggle label={say("shell.theme")} variant="ghost" />
        </div>
        {BUILD ? (
          <p className="px-3 py-1 text-xs text-fg-muted" data-testid="app-version">
            {say("shell.devBuild", { version: BUILD })}
          </p>
        ) : null}
      </AccountMenu>
    </span>
  );
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
      >
        <RailNav.Item asChild icon={<HomeIcon size={22} />} label={say("shell.library")} current={active === "library"}>
          <Link href={href(CONSOLE_ROUTES.library)} />
        </RailNav.Item>
        <RailNav.Item asChild icon={<CheckIcon size={22} />} label={say("shell.checks")} current={active === "check"}>
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
              <ButtonLink href={href(CONSOLE_ROUTES.check)} size="sm" shape="cut" data-testid="header-check">
                <PlusIcon size={16} aria-hidden />
                {say("shell.checkAction")}
              </ButtonLink>
              {account()}
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
