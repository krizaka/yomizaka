import { Redirect } from "expo-router";

import { routes } from "@/domain/links";
import { currentLocale } from "@/i18n";

/** The app opens on the check: the thing people came for. */
export default function Index() {
  return <Redirect href={routes.verify(currentLocale()) as never} />;
}
