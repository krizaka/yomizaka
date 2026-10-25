"use client";

import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";
import type { DocumentSummary } from "@yomizaka/core";

import { ButtonLink } from "@/components/ButtonLink";
import { CONSOLE_ROUTES } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";

import { DocumentTable } from "./DocumentTable";

/** « Documents » (B2, P14): every document, in the table the collections use — sortable, filterable, a row leading to its report. */
export function AllDocuments({ documents }: { documents: DocumentSummary[] }) {
  const { say, locale } = useSay();
  return (
    <div className="flex flex-col gap-6" data-testid="all-documents">
      <PageHeader title={say("documentsPage.title")} description={say("documentsPage.lead")} />
      {documents.length ? (
        <DocumentTable rows={documents} caption={say("documentsPage.caption")} />
      ) : (
        <EmptyState
          icon={<Mascot bird="owl" mood="empty" size={96} />}
          title={say("documentsPage.empty")}
          action={
            <ButtonLink href={`/${locale}${CONSOLE_ROUTES.check}`} variant="primary" size="md">
              {say("shell.checkAction")}
            </ButtonLink>
          }
          data-testid="documents-empty"
        />
      )}
    </div>
  );
}
