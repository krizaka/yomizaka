import { EnvironmentNotice } from "@krizaka/ui/environment-notice";

import { TopChromeOffset } from "@/components/TopChromeOffset";
import { appEnvironment } from "@/lib/env";
import { getDictionary, type Locale } from "@/lib/i18n";

/**
 * « Development version, data can be reset, not a commercial offer » (yomizaka#364): the `EnvironmentNotice` of @krizaka/ui,
 * once, in the root layout, so every page of the deployment carries it. The stage is `APP_ENVIRONMENT`, read once; `prod`
 * renders nothing. Never a banner of our own, never an `if` per page. `data-top-chrome` tells the home's first-screen check that this block stands above the page in the flow, and `TopChromeOffset` lets the fixed bar clear it.
 */
export function StageNotice({ locale, stage = appEnvironment() }: Readonly<{ locale: Locale; stage?: string }>) {
  const { title, message } = getDictionary(locale).stage;
  return (
    <>
      <EnvironmentNotice data-top-chrome stage={stage} title={title} message={message} />
      {/* The fixed bar stands below the notice while it is in view (yomizaka#449). */}
      <TopChromeOffset />
    </>
  );
}
