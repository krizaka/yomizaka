"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";
import { Tabs } from "@krizaka/ui/tabs";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { ButtonLink } from "@/components/ButtonLink";
import type { CheckSummary } from "@/lib/checks";
import { runningChecks } from "@/lib/checks-live";
import { CHECKS_TAB_KEY, CHECKS_TABS, checksTabHref, checksTabOf, CONSOLE_ROUTES } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";

import { BatchImport } from "./BatchImport";
import { STATUS_TONE } from "./DocumentTable";
import { formatDate } from "./format";
import { tableLabels } from "./table-labels";

/** The checks, one row each: the document (a link to its report), what ran, the result, when, the run. A phone keeps the title and the result. */
function ChecksTable({ rows }: { rows: CheckSummary[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<CheckSummary>[]>(
    () => [
      {
        id: "title",
        header: say("checks.columns.document"),
        card: "title",
        filter: "text",
        value: (c) => c.title,
        cell: (c) => (
          <Link href={`/${locale}/app/documents/${c.documentId}/rapport`} className="font-semibold text-fg hover:text-fg-accent hover:underline" aria-label={say("library.open", { title: c.title })}>
            {c.title}
          </Link>
        ),
      },
      { id: "kind", header: say("checks.columns.kind"), priority: 2, value: (c) => c.kind, cell: (c) => say(`kinds.${c.kind}`) },
      { id: "studio", header: say("checks.columns.check"), priority: 2, value: (c) => c.studio, cell: (c) => say(`batch.studios.${c.studio}`) },
      { id: "result", header: say("checks.columns.result"), type: "status", value: (c) => c.result, cell: (c) => <Badge tone={STATUS_TONE[c.result]}>{say(`statuses.${c.result}`)}</Badge> },
      { id: "at", header: say("checks.columns.when"), priority: 2, align: "end", value: (c) => c.at, cell: (c) => formatDate(c.at, locale) },
      { id: "run", header: say("checks.columns.run"), priority: 3, value: (c) => c.runId ?? "", cell: (c) => <code className="break-all font-mono text-xs text-fg-muted">{c.runId ?? "—"}</code> },
    ],
    [say, locale],
  );
  const labels = useMemo(() => tableLabels(say), [say]);
  return <DataTable caption={say("checks.caption")} rows={rows} columns={columns} getRowId={(c) => c.id} rowLabel={(c) => c.title} pageSize={12} labels={labels} />;
}

/**
 * The Vérifications destination (the UX review's § 4.1): the list of every check, « Lots » as a second tab in the address
 * (`?tab=lots`, where the batches live), and — with nothing checked yet — the owl and the one action, « Vérifier un document ».
 */
export function ChecksView({ checks, batches }: { checks: CheckSummary[]; batches: boolean }) {
  const { say, locale } = useSay();
  const path = usePathname() ?? `/${locale}${CONSOLE_ROUTES.checks}`;
  const search = useSearchParams();
  const router = useRouter();
  const tab = batches ? checksTabOf(search?.get(CHECKS_TAB_KEY)) : CHECKS_TABS[0];
  // While a check runs the list asks again every 4 s (the page refreshes it from Orazaka), as the documents table does.
  const live = runningChecks(checks).length > 0;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [live, router]);
  // Each tab names itself for the match (`?tab=checks` · `?tab=lots`); the first one's real link keeps the address clean.
  const current = `${path}?${CHECKS_TAB_KEY}=${tab}`;
  return (
    <div className="flex flex-col gap-6" data-live={live || undefined}>
      <PageHeader
        title={say("checks.title")}
        description={say("checks.lead")}
        actions={
          batches && tab !== "lots" ? (
            <ButtonLink href={checksTabHref(locale, "lots")} variant="secondary" size="md">
              {say("checks.import")}
            </ButtonLink>
          ) : null
        }
      />
      {batches ? (
        <Tabs.Nav label={say("checks.tabsLabel")} current={current}>
          {CHECKS_TABS.map((t) => (
            <Tabs.NavLink key={t} href={`${path}?${CHECKS_TAB_KEY}=${t}`} exact asChild>
              <Link href={checksTabHref(locale, t)} scroll={false}>
                {say(`checks.tabs.${t}`)}
              </Link>
            </Tabs.NavLink>
          ))}
        </Tabs.Nav>
      ) : null}
      {tab === "lots" ? (
        <BatchImport />
      ) : checks.length ? (
        <ChecksTable rows={checks} />
      ) : (
        <EmptyState
          icon={<Mascot bird="owl" mood="empty" size={120} />}
          title={say("checks.empty.title")}
          description={say("checks.empty.text")}
          action={
            <ButtonLink href={`/${locale}${CONSOLE_ROUTES.check}`} variant="primary" size="md" shape="cut">
              {say("shell.checkAction")}
            </ButtonLink>
          }
          data-testid="checks-empty"
        />
      )}
    </div>
  );
}
