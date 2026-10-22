import { Redirect, useLocalSearchParams } from "expo-router";

import { routes } from "@/domain/links";
import { useLocale } from "@/use-locale";

/** A document opens on its information, like the web (/documents/[id]/infos). */
export default function DocumentIndex() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useLocale();
  return <Redirect href={routes.document(locale, id) as never} />;
}
