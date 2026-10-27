import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";

import { BinderTabs } from "./HomeSections";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/app", useSearchParams: () => new URLSearchParams() }));

const long = "Candidates — 4½ Villeray, the building on the corner of the avenue";
const tabs = [
  { id: "c1", name: "My documents", count: 2, href: "/en/app?collection=c1", hue: undefined },
  { id: "c2", name: long, count: 6, href: "/en/app?collection=c2", hue: undefined },
] as never;

describe("the binder tabs on a phone (yomizaka#457)", () => {
  const html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={{ console: en.console } as never}>
      <BinderTabs tabs={tabs} selectedHref="/en/app?collection=c1" />
    </I18nProvider>,
  );
  it("a long name is cut with an ellipsis inside its tab and said in full as the title, so the row does not scroll sideways at 390 px", () => {
    expect(html).toContain(`title="${long}"`);
    expect(html.match(/data-testid="binder-name"/g)).toHaveLength(2);
    expect(html).toMatch(/class="[^"]*\btruncate\b[^"]*"[^>]*data-testid="binder-name"/);
    expect(html).toMatch(/max-w-\[11rem\]/);
  });
  it("on a phone the row wraps instead of scrolling sideways", () => {
    expect(html).toMatch(/max-sm:flex-wrap[^"]*max-sm:overflow-visible/);
  });
  it("the count stays outside the cut name", () => {
    expect(html).toMatch(/<\/span><span class="tabular-nums" data-testid="binder-count">6<\/span>/);
  });
});
