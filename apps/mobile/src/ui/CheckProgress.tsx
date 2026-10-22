import { Stepper, Txt } from "@krizaka/ui/native";
import { type CheckStep, STEP_STATE } from "@yomizaka/core";
import { stepperSteps } from "@yomizaka/client";
import * as React from "react";
import { View } from "react-native";

import { type MessageKey, useI18n } from "@/i18n";

/** A check's four steps (the contract every app and the web draw, `checkSteps` of @yomizaka/core) with the Krizaka Stepper; the engine gives no percentage, so none is invented. */
export function CheckProgress({ steps, runId }: { steps: readonly CheckStep[]; runId: string | null }) {
  const { t } = useI18n();
  const working = steps.some((step) => step.state === STEP_STATE.current);
  return (
    <View style={{ gap: 12 }}>
      <Stepper
        aria-label={t("steps.label")}
        steps={stepperSteps(steps, (key) => t(key as MessageKey))}
        statusLabels={{ done: t("steps.state.done"), current: t("steps.state.current"), upcoming: t("steps.state.upcoming"), error: t("steps.state.error") }}
      />
      {working ? <Txt tone="secondary">{t("result.runningHint")}</Txt> : null}
      {runId ? (
        <Txt tone="muted" variant="mono">
          {t("check.run", { runId })}
        </Txt>
      ) : null}
    </View>
  );
}
