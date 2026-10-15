"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { useMemo } from "react";

import type { AdminDocument, AdminRun, AuditEntry } from "@/lib/admin";
import { useSay } from "@/lib/i18n-client";

import { formatBytes, formatDate } from "../console/format";

const RUN_TONE: Record<string, "accent" | "success" | "danger" | "neutral"> = { running: "accent", succeeded: "success", failed: "danger", cancelled: "neutral" };

export function RunsTable({ rows }: { rows: AdminRun[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminRun>[]>(
    () => [
      { id: "started", header: say("adminConsole.runs.started"), sortable: true, value: (r) => r.createdAt, cell: (r) => formatDate(r.createdAt, locale, true) },
      { id: "studio", header: say("adminConsole.runs.studio"), sortable: true, card: "title", value: (r) => r.studio, filter: "facet" },
      { id: "status", header: say("adminConsole.runs.status"), value: (r) => r.status, cell: (r) => <Badge tone={RUN_TONE[r.status] ?? "neutral"}>{say(`analysis.statuses.${r.status}`)}</Badge> },
      { id: "runId", header: say("adminConsole.runs.runId"), value: (r) => r.runId ?? "", cell: (r) => <code className="font-mono text-xs">{r.runId ?? "—"}</code> },
      { id: "duration", header: say("adminConsole.runs.duration"), sortable: true, align: "end", value: (r) => r.durationSeconds ?? -1, cell: (r) => (r.durationSeconds === null ? "—" : `${r.durationSeconds} s`) },
      { id: "document", header: say("adminConsole.runs.document"), value: (r) => r.document },
      { id: "owner", header: say("adminConsole.runs.owner"), value: (r) => r.owner },
      { id: "error", header: say("adminConsole.runs.error"), value: (r) => r.error ?? "", cell: (r) => (r.error ? <span className="text-danger">{r.error}</span> : "—") },
    ],
    [say, locale],
  );
  return <DataTable caption={say("adminConsole.runs.caption")} showCaption rows={rows} columns={columns} getRowId={(r) => r.id} rowLabel={(r) => r.runId ?? r.id} defaultSort={{ column: "started", direction: "descending" }} pageSize={50} />;
}

export function DocumentsTable({ rows }: { rows: AdminDocument[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminDocument>[]>(
    () => [
      { id: "title", header: say("adminConsole.documents.title"), sortable: true, card: "title", value: (d) => d.title },
      { id: "owner", header: say("adminConsole.documents.owner"), sortable: true, value: (d) => d.owner, filter: "facet" },
      { id: "kind", header: say("adminConsole.documents.kind"), value: (d) => d.kind, cell: (d) => say(`kinds.${d.kind}`) },
      { id: "type", header: say("adminConsole.documents.type"), value: (d) => (d.mimeType === "application/pdf" ? "PDF" : "TXT") },
      { id: "size", header: say("adminConsole.documents.size"), sortable: true, align: "end", value: (d) => d.sizeBytes, cell: (d) => formatBytes(d.sizeBytes, locale) },
      { id: "analyses", header: say("adminConsole.documents.analyses"), sortable: true, align: "end", value: (d) => d.analyses },
      { id: "added", header: say("adminConsole.documents.added"), sortable: true, align: "end", value: (d) => d.createdAt, cell: (d) => formatDate(d.createdAt, locale) },
    ],
    [say, locale],
  );
  return <DataTable caption={say("adminConsole.documents.caption")} showCaption rows={rows} columns={columns} getRowId={(d) => d.id} rowLabel={(d) => d.title} defaultSort={{ column: "added", direction: "descending" }} pageSize={50} />;
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AuditEntry>[]>(
    () => [
      { id: "at", header: say("adminConsole.audit.at"), sortable: true, value: (e) => e.at, cell: (e) => formatDate(e.at, locale, true) },
      { id: "actor", header: say("adminConsole.audit.actor"), sortable: true, card: "title", value: (e) => e.actor, filter: "facet" },
      { id: "action", header: say("adminConsole.audit.action"), value: (e) => e.action, cell: (e) => <code className="font-mono text-xs">{e.action}</code>, filter: "facet" },
      { id: "target", header: say("adminConsole.audit.target"), value: (e) => e.target ?? "", cell: (e) => <code className="break-all font-mono text-xs">{e.target ?? "—"}</code> },
      { id: "ip", header: say("adminConsole.audit.ip"), value: (e) => e.ip ?? "" },
    ],
    [say, locale],
  );
  return <DataTable caption={say("adminConsole.audit.caption")} showCaption rows={entries} columns={columns} getRowId={(e) => e.id} rowLabel={(e) => e.action} defaultSort={{ column: "at", direction: "descending" }} pageSize={50} />;
}
