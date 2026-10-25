"use client";

import { CheckIcon, HomeIcon, KnowledgeIcon, LogoutIcon, PlusIcon, SettingsIcon, ShieldIcon, UserIcon, UsersIcon, WalletIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { YomizakaLogo } from "@krizaka/ui";
import { AccountMenu } from "@krizaka/ui/account-menu";
import { AppHeader } from "@krizaka/ui/app-header";
import { Badge } from "@krizaka/ui/badge";
import { languagesFor,LanguageSwitch } from "@krizaka/ui/language-switch";
import { RailNav } from "@krizaka/ui/rail-nav";
import { ThemeToggle } from "@krizaka/ui/theme";
import { type SectionId, sectionsFor } from "@yomizaka/core";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { activeNav, CONSOLE_ROUTES, withoutLocale } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";
import { pluralKey } from "@/lib/plural";

import { ConsoleSearch } from "./ConsoleSearch";

const BUILD = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const ADMIN_URL = "https://admin.yomizaka.com";
const SECTION_ICONS: Record<SectionId, typeof HomeIcon> = { library: HomeIcon, files: UsersIcon, documents: KnowledgeIcon, checks: CheckIcon };

/**
 * The frame of the signed-in space, on Orazaka's pattern (krizaka/yomizaka#278, the UX review of October 2026): where you work
 * on the rail — the section map of `@yomizaka/core`, the same on the phone and the Mac (yomizaka#319): Bibliothèque ·
 * Dossiers (offered with the applicant-file flow) · Vérifications · Recherche, the collapse control alone at its foot —; the
 * product's name in the header (`AppHeader`) with the DEV chip and the one action of every screen, « Vérifier un document »;
 * who you are under the avatar: profile, settings, billing, language, theme, sign out (Administration for an administrator).
 * The active entry comes from the route (lib/console-nav.ts), never from local state; each page draws its own `h1` (`PageHeader`).
 */
export function ConsoleShell({ locale, email, name, avatarSeed, role, applicantFiles = false, toDecide = 0, children }: { locale: "en" | "fr"; email: string; name?: string; avatarSeed?: string; role: "USER" | "ADMIN"; applicantFiles?: boolean; toDecide?: number; children: React.ReactNode }) {
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
  // The signed-in person is always visible (yomizaka#243): the header's account menu, on every width. The trigger shows the
  // name only when there is one — never the raw e-mail address (the review's A4); the menu's identity header carries both.
  const languages = languagesFor(`/${locale}${rest}`);
  const account = () => (
    <span className="flex">
      <AccountMenu
        label={say("shell.account")}
        name={name}
        email={email}
        showName={name ? "lg" : false}
        avatar={{ defaultAvatar: { brand: "yomizaka", seed: avatarSeed ?? email }, fallback: (name ?? email).charAt(0).toUpperCase() }}
        linkAs={Link}
        links={[
          { id: "profile", label: say("shell.profile"), href: href(`${CONSOLE_ROUTES.account}/profil`), icon: <UserIcon size={16} /> },
          { id: "settings", label: say("shell.settings"), href: href(`${CONSOLE_ROUTES.account}/securite`), icon: <SettingsIcon size={16} /> },
          { id: "billing", label: say("shell.billing"), href: href(`${CONSOLE_ROUTES.account}/facturation`), icon: <WalletIcon size={16} /> },
          ...(role === "ADMIN" ? [{ id: "admin", label: say("shell.admin"), href: ADMIN_URL, icon: <ShieldIcon size={16} /> }] : []),
        ]}
        signOut={{ label: say("shell.signOut"), onSelect: () => signOut.mutate(), icon: <LogoutIcon size={16} /> }}
      >
        {/* A theme row with its visible word (the review's A5): krizaka-ui K3 asks AccountMenu for a `theme` prop; this stands until it ships. */}
        <div className="flex items-center justify-between gap-3 px-3 py-1 text-sm text-fg" data-testid="theme-row">
          <span>{say("shell.theme")}</span>
          <ThemeToggle label={say("shell.theme")} variant="ghost" />
        </div>
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
          <Link href={href(CONSOLE_ROUTES.library)} aria-label="Yomizaka" title="Yomizaka">
            <YomizakaLogo size={28} animated={false} />
          </Link>
        }
      >
        {sectionsFor("web", { applicantFiles }).map((section) => {
          const Icon = SECTION_ICONS[section.id];
          return (
            <RailNav.Item key={section.id} asChild icon={<Icon size={22} />} label={say(`sections.${section.id}`)} current={active === section.id} {...(section.id === "files" && toDecide > 0 ? { badge: toDecide, badgeLabel: say(pluralKey("shell.toDecide", toDecide), { count: toDecide }) } : {})}>
              <Link href={href(section.path)} />
            </RailNav.Item>
          );
        })}
      </RailNav.Root>
      <RailNav.Body className="min-w-0 flex-1">
        <AppHeader
          name="Yomizaka"
          mark={<YomizakaLogo size={26} animated={false} />}
          homeLink={<Link href={href(CONSOLE_ROUTES.library)} aria-label="Yomizaka" />}
          chips={
            BUILD ? (
              <Badge tone="neutral" size="sm" className="hidden sm:inline-flex" data-testid="app-version">
                {say("shell.devBuild", { version: BUILD })}
              </Badge>
            ) : undefined
          }
          // The family's bar (krizaka-ui#640): search · language · primary · account. No messages (Yomizaka has no messaging) and no
          // notifications until `@krizaka/notifications` gives it something to say (krizaka-ts#60): an empty slot is hidden, never invented.
          search={<ConsoleSearch />}
          language={<LanguageSwitch label={say("shell.language")} current={locale} languages={languages} linkAs={Link} />}
          primary={
            // The one action of every signed-in screen: its word from `sm`, its icon and accessible name below.
            <ButtonLink href={href(CONSOLE_ROUTES.check)} variant="gradient" size="sm" shape="cut" aria-label={say("shell.checkAction")} title={say("shell.checkAction")} data-testid="header-check">
              <PlusIcon size={16} aria-hidden />
              <span className="hidden sm:inline">{say("shell.checkAction")}</span>
            </ButtonLink>
          }
          account={account()}
        />
        <main id="content" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6">
          {children}
        </main>
      </RailNav.Body>
    </RailNav.Shell>
  );
}
