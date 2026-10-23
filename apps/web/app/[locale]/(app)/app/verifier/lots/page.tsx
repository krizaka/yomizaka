import { permanentRedirect } from "next/navigation";

import { checksTabHref } from "@/lib/console-nav";
import { asLocale } from "@/lib/i18n";

/** The batches moved under Vérifications (the UX review's § 4.1): the old address answers 308 to its tab. A batch's own page keeps its address. */
export default async function OldBatchesPage({ params }: { params: Promise<{ locale: string }> }) {
  permanentRedirect(checksTabHref(asLocale((await params).locale), "lots"));
}
