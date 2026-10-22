import { Redirect } from "expo-router";

import { routes } from "@/domain/links";
import { useLocale } from "@/use-locale";

/** A library shows its collections on the library screen. */
export default function LibraryIndex() {
  const { locale } = useLocale();
  return <Redirect href={routes.library(locale) as never} />;
}
