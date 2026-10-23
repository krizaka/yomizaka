"use client";

import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { EmptyState } from "@krizaka/ui/empty-state";
import { type ActiveFilter, FilterBar, FilterMenu } from "@krizaka/ui/filter-bar";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";
import { SearchField } from "@krizaka/ui/search-field";
import { Tabs } from "@krizaka/ui/tabs";
import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from "@yomizaka/core";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ButtonLink } from "@/components/ButtonLink";
import type { CheckSummary } from "@/lib/checks";
import { type CheckFilters, checkFiltersOf, filterChecks, isDocumentKind, isDocumentStatus, NO_CHECK_FILTERS, writeChecksFilters } from "@/lib/checks-filter";
import { runningChecks } from "@/lib/checks-live";
import { CHECKS_TAB_KEY, CHECKS_TABS, checksTabHref, checksTabOf, CONSOLE_ROUTES } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";
import { pluralKey } from "@/lib/plural";

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
          <Link href={`/${locale}/app/documents/${c.documentId}/verifications`} className="font-semibold text-fg hover:text-fg-accent hover:underline" aria-label={say("library.open", { title: c.title })}>
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
 * The Vérifications destination (the UX review's § 4.1 and § 4.4): the list of every check with its filters — result, kind and a
 * search by title, all in the address (`?result=attention&kind=lease&q=bail`) — « Lots » as a second tab in the address
 * (`?tab=lots`, where the batches live), and — with nothing checked yet — the owl and the one action, « Vérifier un document ».
 */
export function ChecksView({ checks, batches }: { checks: CheckSummary[]; batches: boolean }) {
  const { say, locale } = useSay();
  const path = usePathname() ?? `/${locale}${CONSOLE_ROUTES.checks}`;
  const search = useSearchParams();
  const router = useRouter();
  const tab = batches ? checksTabOf(search?.get(CHECKS_TAB_KEY)) : CHECKS_TABS[0];
  const filters = search ? checkFiltersOf(search) : NO_CHECK_FILTERS;
  const rows = useMemo(() => filterChecks(checks, filters), [checks, filters]);
  // The search field is uncontrolled (it debounces its own typing); a chip or « Clear » that empties it remounts it.
  const [searchRound, setSearchRound] = useState(0);
  // While a check runs the list asks again every 4 s (the page refreshes it from Orazaka), as the documents table does.
  const live = runningChecks(checks).length > 0;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [live, router]);
  // Each tab names itself for the match (`?tab=checks` · `?tab=lots`); the first one's real link keeps the address clean.
  const current = `${path}?${CHECKS_TAB_KEY}=${tab}`;

  const setFilters = (next: CheckFilters) => {
    const query = writeChecksFilters(new URLSearchParams(search?.toString() ?? ""), next).toString();
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  };
  const clearFilters = () => {
    setSearchRound((n) => n + 1);
    setFilters(NO_CHECK_FILTERS);
  };
  const count = (predicate: (c: CheckSummary) => boolean) => checks.filter(predicate).length;
  const resultOptions = DOCUMENT_STATUSES.map((s) => ({ value: s, label: say(`statuses.${s}`), count: count((c) => c.result === s) }));
  const kindOptions = DOCUMENT_KINDS.map((k) => ({ value: k, label: say(`kinds.${k}`), count: count((c) => c.kind === k) }));
  const active: ActiveFilter[] = [
    ...filters.result.map((s) => ({ id: `result:${s}`, label: `${say("checks.filters.result")}: ${say(`statuses.${s}`)}`, onRemove: () => setFilters({ ...filters, result: filters.result.filter((x) => x !== s) }) })),
    ...filters.kind.map((k) => ({ id: `kind:${k}`, label: `${say("checks.filters.kind")}: ${say(`kinds.${k}`)}`, onRemove: () => setFilters({ ...filters, kind: filters.kind.filter((x) => x !== k) }) })),
    ...(filters.q ? [{ id: "q", label: `${say("checks.filters.search")}: ${filters.q}`, onRemove: () => { setSearchRound((n) => n + 1); setFilters({ ...filters, q: "" }); } }] : []),
  ];

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
        <>
          <FilterBar
            label={say("checks.filters.label")}
            results={say(pluralKey("checks.results", rows.length), { count: rows.length })}
            active={active}
            onClearAll={clearFilters}
            clearLabel={say("library.table.clear")}
            removeLabel={(label) => say("library.table.remove", { label })}
          >
            <SearchField
              key={searchRound}
              label={say("checks.filters.search")}
              placeholder={say("checks.filters.searchPlaceholder")}
              defaultValue={filters.q}
              onSearch={(q) => setFilters({ ...filters, q: q.trim() })}
              clearLabel={say("library.table.clear")}
              debounce={250}
            />
            <FilterMenu
              label={say("checks.filters.result")}
              options={resultOptions}
              value={filters.result}
              onValueChange={(value) => setFilters({ ...filters, result: value.filter(isDocumentStatus) })}
            />
            <FilterMenu label={say("checks.filters.kind")} options={kindOptions} value={filters.kind} onValueChange={(value) => setFilters({ ...filters, kind: value.filter(isDocumentKind) })} />
          </FilterBar>
          {rows.length ? (
            <ChecksTable rows={rows} />
          ) : (
            <EmptyState
              icon={<Mascot bird="owl" mood="thinking" size={96} />}
              title={say("checks.noMatch.title")}
              description={say("checks.noMatch.text")}
              action={
                <Button variant="secondary" size="md" onClick={clearFilters}>
                  {say("library.table.clear")}
                </Button>
              }
              data-testid="checks-nomatch"
            />
          )}
        </>
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
