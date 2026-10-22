import type { Metadata } from "next";

import { LibraryView } from "@/components/console/LibraryView";
import { asLocale, getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shell.titles.check };
}

/** Check a document: the drop zone and nothing else; the new document then opens on its information tab. */
export default function CheckPage() {
  return <LibraryView initial={[]} mode="check" audiences={[]} />;
}
