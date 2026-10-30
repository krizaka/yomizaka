"use client";

import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { Ticks } from "@krizaka/ui/page";

export interface CodeRow {
  code: string;
  meaning: string;
}

/** A reference of codes (a status and its meaning, an event and its summary) as a table: the code in mono, the words beside it, one card per row on a phone. */
const codesColumns = (labels: { code: string; meaning: string }): DataTableColumn<CodeRow>[] => [
  {
    id: "code",
    header: labels.code,
    card: "title",
    maxWidth: 200,
    value: (r) => r.code,
    cell: (r) => <code className="break-words">{r.code}</code>,
  },
  {
    id: "meaning",
    header: labels.meaning,
    value: (r) => r.meaning,
    cell: (r) => (
      <span className="block min-w-0 flex-1 break-words">
        <Ticks>{r.meaning}</Ticks>
      </span>
    ),
  },
];

export function CodesTable({
  rows,
  labels,
}: Readonly<{ rows: readonly CodeRow[]; labels: { caption: string; code: string; meaning: string } }>) {
  return (
    <DataTable
      caption={labels.caption}
      rows={[...rows]}
      columns={codesColumns(labels)}
      getRowId={(r) => r.code}
      rowLabel={(r) => r.code}
    />
  );
}
