import { headers } from "next/headers";

import { NotFoundView } from "@/components/not-found/NotFoundView";
import { localeFromHeader, NOT_FOUND_LOCALE_HEADER } from "@/lib/not-found-locale";

/** A page inside a language that does not exist (or that calls notFound()): the same page as the global one. */
export default async function NotFound() {
  return <NotFoundView locale={localeFromHeader((await headers()).get(NOT_FOUND_LOCALE_HEADER))} />;
}
