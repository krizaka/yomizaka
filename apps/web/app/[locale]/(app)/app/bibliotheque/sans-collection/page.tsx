import { redirect } from "next/navigation";

import { pageSession } from "@/lib/access";
import { query } from "@/lib/db";
import { asLocale } from "@/lib/i18n";
import { libraryPath } from "@/lib/organisation/rules";
import * as org from "@/lib/organisation/store";

/** « Sans collection » no longer exists (krizaka/yomizaka#205): an old link lands on the account's default collection. */
export default async function WithoutCollectionPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = await pageSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const id = await org.defaultCollectionId(query, session.account.id);
  const [collection] = await query<{ library_id: string }>("SELECT library_id FROM collections WHERE id = $1", [id]);
  redirect(libraryPath(locale, collection!.library_id, id));
}
