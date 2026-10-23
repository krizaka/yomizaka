import type { useI18n } from "../i18n";
import type { Refused } from "./prepare";

type T = ReturnType<typeof useI18n>["t"];

/** Why a document did not become a check, in the person's words. */
export function refusalText(refused: Pick<Refused, "reason" | "megabytes">, t: T): string {
  const { reason } = refused;
  switch (reason) {
    case "paywall":
      return t("check.paywall");
    case "feature":
      return t("check.feature");
    case "unreadable":
      return t("check.readFailed");
    case "failed":
      return t("check.startFailed");
    case "tooLarge":
      return t("preflight.tooLarge", { megabytes: refused.megabytes ?? 0 });
    default:
      return t(`preflight.${reason}`);
  }
}
