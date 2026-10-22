import { Progress, StepProgress, Txt } from "@krizaka/ui/native";
import * as React from "react";
import { View } from "react-native";

import { STAGE, STAGES_IN_ORDER, type Stage, stepOf } from "@yomizaka/client";
import { useI18n } from "@/i18n";

/** Where a check is: the three steps, and while it runs a bar that says so (the engine gives no percentage, so it does not invent one). */
export function CheckProgress({ stage, runId }: { stage: Stage; runId: string | null }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      <StepProgress step={stepOf(stage)} total={STAGES_IN_ORDER.length} label={(step, total) => t("stage.step", { step, total })} />
      <Txt variant="label">{t(`stage.${stage}`)}</Txt>
      {stage === STAGE.sending || stage === STAGE.checking ? <Progress value={null} label={t(`stage.${stage}`)} /> : null}
      {stage === STAGE.checking ? <Txt tone="secondary">{t("result.runningHint")}</Txt> : null}
      {runId ? (
        <Txt tone="muted" variant="mono">
          {t("check.run", { runId })}
        </Txt>
      ) : null}
    </View>
  );
}
