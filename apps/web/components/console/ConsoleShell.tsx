"use client";

import { HomeIcon, LogoutIcon, SearchIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { YomizakaLogo } from "@krizaka/ui";
import { AppShell } from "@krizaka/ui/app-shell";
import { Button } from "@krizaka/ui/button";
import { languagesFor,LanguageSwitch } from "@krizaka/ui/language-switch";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSay } from "@/lib/i18n-client";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/**
 * The frame of the signed-in space: @krizaka/ui's AppShell (sidebar that folds to its icons, a drawer on a phone, a
 * header with the page's title), the library and search, and — only for an administrator on an allowed address — the
 * administration.
 */
export function ConsoleShell({ locale, email, children }: { locale: "en" | "fr"; email: string; children: React.ReactNode }) {
  const { say } = useSay();
  const router = useRouter();
  const path = usePathname() ?? "";
  const home = `/${locale}/app`;
  const rest = path.slice(`/${locale}`.length);
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => {
      router.replace(`/${locale}/sign-in`);
      router.refresh();
    },
  });
  const current = (to: string, exact = false) => (exact ? path === to : path === to || path.startsWith(`${to}/`));
  const titleKey = path.startsWith(`${home}/search`) ? "shell.search" : path.startsWith(`${home}/documents`) ? "shell.document" : "shell.library";
  const item = (to: string, label: string, icon: React.ReactNode, exact = false) => (
    <AppShell.Item asChild label={label} icon={icon} current={current(to, exact) || (exact && path.startsWith(`${home}/documents`))}>
      <Link href={to}>{label}</Link>
    </AppShell.Item>
  );
  return (
    <AppShell.Root skipLabel={say("shell.skip")}>
      <AppShell.Sidebar
        label={say("shell.sidebarLabel")}
        brand={
          <Link href={home} className="inline-flex items-center gap-2">
            <YomizakaLogo size={24} animated={false} /> Yomizaka
          </Link>
        }
        closeLabel={say("shell.closeMenu")}
        collapseLabels={[say("shell.collapse"), say("shell.expand")]}
        footer={
          <div className="flex flex-col gap-1 px-3 pb-2 text-xs text-fg-muted">
            <span className="truncate" title={email}>
              {say("shell.signedInAs", { email })}
            </span>
            {VERSION ? <span data-testid="app-version">{say("shell.devBuild", { version: VERSION })}</span> : null}
          </div>
        }
      >
        <AppShell.Group>{say("shell.groupDocuments")}</AppShell.Group>
        {item(home, say("shell.library"), <HomeIcon />, true)}
        {item(`${home}/search`, say("shell.search"), <SearchIcon />)}
      </AppShell.Sidebar>
      <AppShell.Body>
        <AppShell.Header
          title={say(titleKey)}
          menuLabel={say("shell.openMenu")}
          actions={
            <>
              <LanguageSwitch label={say("shell.language")} current={locale} languages={languagesFor(`/${locale}${rest}`)} linkAs={Link} />
              <ThemeToggle label={say("shell.theme")} variant="ghost" />
              <Button size="sm" variant="secondary" shape="cut" loading={signOut.isPending} onClick={() => signOut.mutate()}>
                <LogoutIcon size={16} /> <span className="hidden sm:inline">{say("shell.signOut")}</span>
              </Button>
            </>
          }
        />
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell.Body>
    </AppShell.Root>
  );
}
