import { usePathname, useRouter } from "expo-router";
import * as React from "react";

import { asLocale, type Locale } from "@/domain/links";
import { currentLocale, setCurrentLocale } from "@/i18n";

/** The language is the first segment of the URL, like the web's; outside a localised screen it is the device's. */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const pathname = usePathname();
  const router = useRouter();
  const inPath = /^\/(fr|en)(\/|$)/.exec(pathname)?.[1];
  const locale = inPath ? asLocale(inPath) : currentLocale();
  React.useEffect(() => setCurrentLocale(locale), [locale]);
  const setLocale = React.useCallback((next: Locale) => router.replace(pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${next}`) as never), [pathname, router]);
  return { locale, setLocale };
}
