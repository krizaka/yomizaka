"use client";

import { BillingIcon, EditIcon, HomeIcon, MoreIcon } from "@krizaka/icons";
import { ChoiceCards } from "@krizaka/ui/account-settings";
import { PageHeader } from "@krizaka/ui/page-header";
import { DOCUMENT_KINDS, type DocumentKind, type DocumentSummary, type Jurisdiction } from "@yomizaka/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAppConfig } from "@/lib/app-config-client";
import { checksTabHref, CONSOLE_ROUTES } from "@/lib/console-nav";
import { useSay } from "@/lib/i18n-client";
import { ROUTE_STATES } from "@/lib/route-state";
import { useRouteState } from "@/lib/use-route-state";

import { DocumentUploader } from "./DocumentUploader";
import { startIfSure } from "./start-check";

const ICONS: Record<DocumentKind, typeof HomeIcon> = { lease: HomeIcon, contract: EditIcon, invoice: BillingIcon, other: MoreIcon };

/**
 * « Quel document ? » for one file whose kind Yomizaka did not recognise for sure (yomizaka#318, § 5.4 of the design
 * direction): the kinds as `ChoiceCards`, each with its title and its hint. Picking one starts the check of that file.
 */
export function KindQuestion({ filename, onPick, disabled = false }: { filename: string; onPick: (kind: DocumentKind) => void; disabled?: boolean }) {
  const { say } = useSay();
  return (
    <ChoiceCards
      showLabel
      label={say("library.kindPick")}
      description={say("library.kindUnsure", { name: filename })}
      options={DOCUMENT_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        return { id: kind, icon: <Icon size={20} />, title: say(`kinds.${kind}`), description: say(`library.kindHints.${kind}`), disabled };
      })}
      onValueChange={(id) => onPick(id as DocumentKind)}
      data-testid="kind-choice"
    />
  );
}

/**
 * « Vérifier un document », the task page the header's action opens (the UX review's Y4): the drop zone, the options folded
 * once files are known. The kind is never asked before the drop (`?type=` may still name it): a file whose kind is sure
 * starts its check at once and opens on its report (`lib/check-flow.ts`); an uncertain one is asked « Quel document ? »
 * here, for that file only (yomizaka#318).
 */
export function CheckView({ jurisdictions = ["QC"] }: { jurisdictions?: readonly Jurisdiction[] }) {
  const { say, locale } = useSay();
  const router = useRouter();
  const [kind] = useRouteState(ROUTE_STATES.checkKind.state);
  const app = useAppConfig();
  const kindRef = useRef<DocumentKind | "auto">(kind);
  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);
  const [unsure, setUnsure] = useState<DocumentSummary | null>(null);
  const [starting, setStarting] = useState(false);
  // A refusal (an entitlement, a rule) travels to the report tab, which says it above its own form.
  const report = (id: string, refused: string | null) => router.push(`/${locale}/app/documents/${id}/rapport${refused ? `?refused=${encodeURIComponent(refused)}` : ""}`);
  const open = async (document: DocumentSummary, requested: DocumentKind | "auto") => {
    const outcome = await startIfSure(document.id, requested, jurisdictions, new Date());
    if (!outcome.started && !outcome.refused && requested === "auto") setUnsure(document);
    else report(document.id, outcome.refused);
  };
  const pick = async (document: DocumentSummary, chosen: DocumentKind) => {
    setStarting(true);
    // Named by the person, the kind is sure; a mismatch with what Yomizaka read is still confirmed on the report tab.
    const outcome = await startIfSure(document.id, chosen, jurisdictions, new Date());
    report(document.id, outcome.refused);
  };
  return (
    <section className="flex max-w-3xl flex-col gap-5" aria-label={say("library.dropTitle")}>
      <PageHeader
        breadcrumb={
          <Link href={`/${locale}${CONSOLE_ROUTES.library}`} className="text-sm text-fg-muted hover:text-fg">
            ← {say("shell.library")}
          </Link>
        }
        title={say("shell.titles.check")}
        description={say("library.checkLead")}
      />
      <DocumentUploader kindRef={kindRef} onUploaded={(d, requested) => void open(d, requested)} />
      {unsure ? <KindQuestion filename={unsure.filename} disabled={starting} onPick={(chosen) => void pick(unsure, chosen)} /> : null}
      {app?.features.batches ? (
        <p className="m-0 text-sm text-fg-secondary">
          {say("batch.fromCheck")}{" "}
          <Link className="font-semibold text-fg-accent underline-offset-2 hover:underline" href={checksTabHref(locale, "lots")}>
            {say("batch.fromCheckLink")}
          </Link>
        </p>
      ) : null}
      <p className="m-0 text-xs text-fg-muted">{say("library.informative")}</p>
    </section>
  );
}
