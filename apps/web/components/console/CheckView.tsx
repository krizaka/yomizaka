"use client";

import { RadioGroup } from "@krizaka/ui/radio-group";
import { DOCUMENT_KINDS, type DocumentKind } from "@yomizaka/core";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useSay } from "@/lib/i18n-client";

import { DocumentUploader } from "./DocumentUploader";

/** « Check a document »: the drop zone and nothing else; the new document then opens on what it is (its information tab). */
export function CheckView() {
  const { say, locale } = useSay();
  const router = useRouter();
  const [kind, setKind] = useState<DocumentKind | "auto">("auto");
  const kindRef = useRef(kind);
  return (
    <section className="flex max-w-3xl flex-col gap-3" aria-label={say("library.dropTitle")}>
      <RadioGroup.Root variant="segmented" label={say("library.kindLabel")} value={kind} onValueChange={(v: string) => {
          kindRef.current = v as DocumentKind | "auto";
          setKind(v as DocumentKind | "auto");
        }}>
        {(["auto", ...DOCUMENT_KINDS] as const).map((k) => (
          <RadioGroup.Segment key={k} value={k}>
            {say(`kinds.${k}`)}
          </RadioGroup.Segment>
        ))}
      </RadioGroup.Root>
      <DocumentUploader kindRef={kindRef} onUploaded={(d) => router.push(`/${locale}/app/documents/${d.id}/infos`)} />
    </section>
  );
}
