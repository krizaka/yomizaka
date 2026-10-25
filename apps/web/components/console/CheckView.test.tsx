import { KrizakaQueryProvider } from "@krizaka/query";
import { DOCUMENT_KINDS } from "@yomizaka/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { CheckQueue, CheckView, KindQuestion } from "./CheckView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/fr/app/verifier", useSearchParams: () => new URLSearchParams() }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "(?:'|&#x27;)");
const wrap = (node: React.ReactNode, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>{node}</KrizakaQueryProvider>
    </I18nProvider>,
  );
const render = (locale: "en" | "fr" = "fr") => wrap(<CheckView />, locale);

describe("« Vérifier un document » (the UX review's Y4)", () => {
  it("has one h1 and the drop zone; the kind is not asked before a drop, Yomizaka recognises it from the file (yomizaka#318)", () => {
    const html = render();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.indexOf(fr.console.library.dropTitle)).toBeGreaterThan(0);
    expect(html).not.toContain('role="radiogroup"');
    expect(html).not.toContain('data-testid="kind-choice"');
    expect(readable(html)).not.toContain(fr.console.library.kindPick);
  });

  it("names the defaults before the drop, with « Modifier » (Errata 6, yomizaka#326), and says the check is informative", () => {
    const html = render();
    const defaults = html.indexOf('data-testid="check-defaults"');
    expect(defaults).toBeGreaterThan(0);
    // Before the drop zone (its title after the page's h1; the section's own label carries it too).
    expect(defaults).toBeLessThan(html.indexOf(fr.console.library.dropTitle, html.indexOf("</h1>")));
    const text = readable(html);
    for (const key of ["erased", "rules", "place", "modify"] as const) expect(text).toContain(fr.console.check.defaults[key]);
    expect(html).toContain('data-testid="keep-choice"');
    // « Ces photos sont les pages d'un document » only once photos are known (the review's C3).
    expect(html).not.toContain('data-testid="group-photos"');
    expect(readable(html)).toContain(fr.console.library.informative);
    expect(readable(render("en"))).toContain(en.console.library.informative);
  });
});

describe("the kind picker, asked only when the kind is uncertain (yomizaka#318, P1 of the design direction)", () => {
  for (const locale of ["fr", "en"] as const) {
    const m = MESSAGES[locale].console;
    it(`asks « ${m.library.kindPick} » for that file as a labelled radiogroup of cards, each kind's title and hint as separate text (${locale})`, () => {
      const html = wrap(<KindQuestion filename="scan-0042.pdf" onPick={() => {}} />, locale);
      const group = html.match(/<[^>]+role="radiogroup"[^>]*>/)?.[0] ?? "";
      expect(group, "a radiogroup").not.toBe("");
      const labelledBy = group.match(/aria-labelledby="([^"]+)"/)?.[1];
      expect(labelledBy, "labelled by the visible question").toBeTruthy();
      expect(html).toMatch(new RegExp(`id="${escape(labelledBy!)}"[^>]*>(?:<[^>]+>)*${escape(m.library.kindPick)}<`));
      for (const kind of DOCUMENT_KINDS) {
        // The title and the hint are two elements, never « BailLoyer, durée… » glued in one text node.
        expect(html).toMatch(new RegExp(`>${escape(m.kinds[kind])}</span>`));
        expect(html).toMatch(new RegExp(`<span id="[^"]+"[^>]*>${escape(m.library.kindHints[kind])}</span>`));
      }
      expect(readable(html)).not.toContain(m.kinds.auto);
      expect(readable(html)).toContain(m.library.kindUnsure.replace("{name}", "scan-0042.pdf"));
      expect(html).toContain('data-testid="kind-choice"');
    });
  }
});

describe("the queue: one row per file, its stage in words (yomizaka#326, P9)", () => {
  const row = (id: string, stage: string, refused: string | null = null) => ({ id, filename: `${id}.pdf`, stage, refused }) as never;
  const queue = (rows: never[], locale: "en" | "fr" = "fr") => wrap(<CheckQueue rows={rows} onPick={() => {}} />, locale);

  it("says every stage in words — progress is never a bare bar, so reduced motion keeps it", () => {
    for (const locale of ["fr", "en"] as const) {
      const m = MESSAGES[locale].console.check.stages;
      const text = readable(queue([row("a", "reading"), row("b", "starting"), row("c", "started"), row("d", "refused", "PAYWALL")], locale));
      expect(text).toContain(m.reading);
      expect(text).toContain(m.starting);
      expect(text).toContain(m.started);
      expect(text).toContain(m.refused.replace("{reason}", MESSAGES[locale].console.errors.PAYWALL));
    }
  });

  it("asks « Quel document ? » for each uncertain file, its own labelled question, and no other", () => {
    const html = queue([row("a", "asking"), row("b", "started"), row("c", "asking")]);
    expect(html.match(/role="radiogroup"/g)).toHaveLength(2);
    expect(readable(html)).toContain(fr.console.library.kindUnsure.replace("{name}", "a.pdf"));
    expect(readable(html)).toContain(fr.console.library.kindUnsure.replace("{name}", "c.pdf"));
    expect(readable(html)).not.toContain(fr.console.library.kindUnsure.replace("{name}", "b.pdf"));
  });

  it("links a row that is under way, or refused, to its report", () => {
    const html = queue([row("a", "started"), row("b", "refused", "PAYWALL"), row("c", "reading")]);
    expect(html).toContain('href="/fr/app/documents/a/rapport"');
    expect(html).toContain('href="/fr/app/documents/b/rapport?refused=PAYWALL"');
    expect(html).not.toContain('href="/fr/app/documents/c/rapport"');
  });
});
