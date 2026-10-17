import { ComparisonTable } from "@krizaka/ui/comparison-table";
import { Section } from "@krizaka/ui/page";

import { getDictionary, type Locale } from "@/lib/i18n";

/** Yomizaka, reading alone, a lawyer — the honest comparison: the lawyer advises and carries the responsibility; Yomizaka does not. */
export function ComparisonSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.comparison;
  const rows = (["what", "time", "advice", "proof", "review"] as const).map((id) => ({ id, topic: t.rows[id].topic, answers: { yomizaka: t.rows[id].yomizaka, alone: t.rows[id].alone, lawyer: t.rows[id].lawyer } }));
  return (
    <Section id="comparison" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <ComparisonTable label={t.title} topicLabel={t.topic} columns={[{ id: "yomizaka", label: t.columns.yomizaka }, { id: "alone", label: t.columns.alone }, { id: "lawyer", label: t.columns.lawyer }]} highlight="yomizaka" rows={rows} />
    </Section>
  );
}
