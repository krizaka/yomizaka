"use client";

import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import Link from "next/link";
import { useMemo } from "react";

import type { AdminFlow } from "@/lib/flows";
import { useSay } from "@/lib/i18n-client";

type Say = ReturnType<typeof useSay>["say"];
type Lang = ReturnType<typeof useSay>["locale"];

function flowColumns(say: Say, locale: Lang): DataTableColumn<AdminFlow>[] {
  return [
    {
      id: "key",
      header: say("adminConsole.flows.columns.key"),
      sortable: true,
      card: "title",
      value: (f) => f.key,
      cell: (f) => (
        <Link className="font-semibold text-fg hover:text-fg-accent hover:underline" href={`/${locale}/flows/${f.id}`}>
          {f.key}
        </Link>
      ),
    },
    { id: "title", header: say("adminConsole.flows.columns.title"), value: (f) => f.title },
    {
      id: "audiences",
      header: say("adminConsole.flows.columns.audiences"),
      value: (f) => f.audiences.join(", "),
      cell: (f) => (
        <span className="flex flex-wrap gap-1">
          {f.audiences.map((a) => (
            <Badge key={a} tone="neutral">
              {say(`adminConsole.flows.editor.${a}`)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: "version",
      header: say("adminConsole.flows.columns.version"),
      align: "end",
      value: (f) => f.currentVersion ?? 0,
      cell: (f) => (f.currentVersion ? `v${f.currentVersion}` : "—"),
    },
    {
      id: "status",
      header: say("adminConsole.flows.columns.status"),
      value: (f) => f.status ?? "",
      cell: (f) =>
        f.status ? (
          <Badge tone={f.status === "available" ? "success" : "warning"}>
            {say(`adminConsole.flows.status.${f.status}`)}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      id: "dev",
      header: say("adminConsole.flows.columns.dev"),
      value: (f) => String(f.environments.dev),
      cell: (f) => <Badge tone={f.environments.dev ? "success" : "neutral"}>{f.environments.dev ? "on" : "off"}</Badge>,
    },
    {
      id: "prod",
      header: say("adminConsole.flows.columns.prod"),
      value: (f) => String(f.environments.prod),
      cell: (f) => (
        <Badge tone={f.environments.prod ? "success" : "neutral"}>{f.environments.prod ? "on" : "off"}</Badge>
      ),
    },
  ];
}

/** The flows: key, title, audiences, current version, status, enabled in dev / prod. */
export function FlowsTable({ flows }: Readonly<{ flows: AdminFlow[] }>) {
  const { say, locale } = useSay();
  const columns = useMemo(() => flowColumns(say, locale), [say, locale]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="m-0 max-w-[70ch] text-sm text-fg-secondary">{say("adminConsole.flows.lead")}</p>
        <Button asChild size="md">
          <Link href={`/${locale}/flows/new`}>{say("adminConsole.flows.new")}</Link>
        </Button>
      </div>
      <DataTable
        caption={say("adminConsole.flows.caption")}
        rows={flows}
        columns={columns}
        getRowId={(f) => f.id}
        rowLabel={(f) => f.key}
        defaultSort={{ column: "key", direction: "ascending" }}
      />
    </div>
  );
}
