"use client";

import { RadioGroup } from "@krizaka/ui/radio-group";
import type { DocumentKind } from "@yomizaka/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAppConfig } from "@/lib/app-config-client";
import { useSay } from "@/lib/i18n-client";
import { CHECK_KINDS, ROUTE_STATES } from "@/lib/route-state";
import { useRouteState } from "@/lib/use-route-state";

import { DocumentUploader } from "./DocumentUploader";

/** « Check a document »: the drop zone and nothing else; the new document then opens on what it is (its information tab). */
export function CheckView() {
  const { say, locale } = useSay();
  const router = useRouter();
  const [kind] = useRouteState(ROUTE_STATES.checkKind.state);
  const app = useAppConfig();
  const kindRef = useRef<DocumentKind | "auto">(kind);
  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);
  return (
    <section className="flex max-w-3xl flex-col gap-3" aria-label={say("library.dropTitle")}>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-fg">{say("library.kindPick")}</p>
        <RadioGroup.Root variant="buttons" label={say("library.kindPick")} routeKey={ROUTE_STATES.checkKind.state.key} routeValues={CHECK_KINDS} defaultValue={ROUTE_STATES.checkKind.state.fallback}>
          {CHECK_KINDS.map((k) => (
            <RadioGroup.Button key={k} value={k} hint={say(`library.kindHints.${k}`)}>
              {say(`kinds.${k}`)}
            </RadioGroup.Button>
          ))}
        </RadioGroup.Root>
      </div>
      <DocumentUploader kindRef={kindRef} onUploaded={(d) => router.push(`/${locale}/app/documents/${d.id}/infos`)} />
      {app?.features.batches ? (
        <p className="text-sm text-fg-secondary">
          {say("batch.fromCheck")}{" "}
          <Link className="font-semibold text-fg-accent underline-offset-2 hover:underline" href={`/${locale}/app/verifier/lots`}>
            {say("batch.fromCheckLink")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
