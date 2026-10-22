"use client";

import { RadioGroup } from "@krizaka/ui/radio-group";
import type { DocumentKind } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSay } from "@/lib/i18n-client";
import { CHECK_KINDS, ROUTE_STATES } from "@/lib/route-state";
import { useRouteState } from "@/lib/use-route-state";

import { DocumentUploader } from "./DocumentUploader";

/** « Check a document »: the drop zone and nothing else; the new document then opens on what it is (its information tab). */
export function CheckView() {
  const { say, locale } = useSay();
  const router = useRouter();
  const [kind] = useRouteState(ROUTE_STATES.checkKind.state);
  const kindRef = useRef<DocumentKind | "auto">(kind);
  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);
  return (
    <section className="flex max-w-3xl flex-col gap-3" aria-label={say("library.dropTitle")}>
      <RadioGroup.Root variant="segmented" label={say("library.kindLabel")} routeKey={ROUTE_STATES.checkKind.state.key} routeValues={CHECK_KINDS} defaultValue={ROUTE_STATES.checkKind.state.fallback}>
        {CHECK_KINDS.map((k) => (
          <RadioGroup.Segment key={k} value={k}>
            {say(`kinds.${k}`)}
          </RadioGroup.Segment>
        ))}
      </RadioGroup.Root>
      <DocumentUploader kindRef={kindRef} onUploaded={(d) => router.push(`/${locale}/app/documents/${d.id}/infos`)} />
    </section>
  );
}
