"use client";

import { ClockIcon, HomeIcon, KeepIcon, LogoutIcon, ServerIcon, ShieldIcon, UsersIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { YomizakaLogo } from "@krizaka/ui";
import { AppShell } from "@krizaka/ui/app-shell";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { languagesFor,LanguageSwitch } from "@krizaka/ui/language-switch";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSay } from "@/lib/i18n-client";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/** admin.yomizaka.com: @krizaka/ui's AppShell console — overview, people, documents, Orazaka runs, audit — and a DEV badge. */
export function AdminShell({ locale, email, children }: { locale: "en" | "fr"; email: string; children: React.ReactNode }) {
  const { say } = useSay();
  const router = useRouter();
  const path = usePathname() ?? "";
  const home = `/${locale}`;
  const rest = path.slice(home.length);
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => {
      router.replace(`${home}/sign-in`);
      router.refresh();
    },
  });
  const pages = [
    { to: home, key: "overview", icon: <HomeIcon />, exact: true },
    { to: `${home}/users`, key: "users", icon: <UsersIcon /> },
    { to: `${home}/documents`, key: "documents", icon: <KeepIcon /> },
    { to: `${home}/flows`, key: "flows", icon: <ShieldIcon /> },
    { to: `${home}/runs`, key: "runs", icon: <ServerIcon /> },
    { to: `${home}/operations`, key: "operations", icon: <ShieldIcon /> },
    { to: `${home}/audit`, key: "audit", icon: <ClockIcon /> },
  ];
  const isCurrent = (p: (typeof pages)[number]) => (p.exact ? path === p.to : path === p.to || path.startsWith(`${p.to}/`));
  const current = pages.find(isCurrent) ?? pages[0]!;
  return (
    <AppShell.Root skipLabel={say("shell.skip")}>
      <AppShell.Sidebar
        label={say("adminConsole.shell.title")}
        brand={
          <Link href={home} className="inline-flex items-center gap-2">
            <YomizakaLogo size={24} animated={false} /> Yomizaka <Badge tone="warning">{say("adminConsole.shell.dev")}</Badge>
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
        <AppShell.Group>{say("adminConsole.shell.title")}</AppShell.Group>
        {pages.map((p) => (
          <AppShell.Item key={p.key} asChild label={say(`adminConsole.shell.${p.key}`)} icon={p.icon} current={isCurrent(p)}>
            <Link href={p.to}>{say(`adminConsole.shell.${p.key}`)}</Link>
          </AppShell.Item>
        ))}
      </AppShell.Sidebar>
      <AppShell.Body>
        <AppShell.Header
          title={say(`adminConsole.shell.${current.key}`)}
          menuLabel={say("shell.openMenu")}
          actions={
            <>
              <LanguageSwitch label={say("shell.language")} current={locale} languages={languagesFor(`/${locale}${rest}`)} linkAs={Link} />
              <ThemeToggle label={say("shell.theme")} variant="ghost" />
              <Button size="sm" variant="secondary" shape="cut" loading={signOut.isPending} onClick={() => signOut.mutate()}>
                <LogoutIcon size={16} /> <span className="hidden sm:inline">{say("adminConsole.shell.signOut")}</span>
              </Button>
            </>
          }
        />
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell.Body>
    </AppShell.Root>
  );
}
