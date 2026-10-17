"use client";

import { format } from "@krizaka/i18n";
import { type ShowcaseStep, StepShowcase } from "@krizaka/ui/step-showcase";

/**
 * The router's adapter of @krizaka/ui's StepShowcase: the server page passes plain words (a function cannot cross into a
 * client component), this builds the controls' labels. A phone below md, a browser from md — only the one shown plays
 * (StepShowcase loads a recording once it is in view).
 */
export function JourneyTour({
  label,
  phone,
  desktop,
  address,
  words,
}: {
  label: string;
  phone: readonly ShowcaseStep[];
  desktop: readonly ShowcaseStep[];
  address: string;
  words: { play: string; pause: string; step: string };
}) {
  const labels = { play: words.play, pause: words.pause, step: (n: number, total: number) => format(words.step, { n, total }) };
  return (
    <>
      <div className="md:hidden">
        <StepShowcase label={label} steps={phone} device="phone" labels={labels} />
      </div>
      <div className="hidden md:block">
        <StepShowcase label={label} steps={desktop} device="browser" deviceTitle={address} labels={labels} />
      </div>
    </>
  );
}
