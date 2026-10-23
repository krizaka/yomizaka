import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import fr from "@/messages/fr.json";

import NotFound from "./not-found";

const nav = vi.hoisted(() => ({ locale: "fr" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-locale": nav.locale }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/fr/nope" }));

const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("the 404 (the UX review's Y10)", () => {
  it("is the owl's page in the language of the address, with one h1 and the ways back: the library first, then the home", async () => {
    nav.locale = "fr";
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain('data-testid="not-found"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const text = readable(html);
    expect(text).toContain(fr.console.notFound.title);
    expect(text).toContain(fr.console.notFound.library);
    expect(html).toContain('href="/fr/app"');
    expect(html).toContain('href="/fr"');
    expect(html.indexOf('href="/fr/app"')).toBeLessThan(html.indexOf('href="/fr"'));
  });
  it("answers in English on an English address, and in English when the address says nothing", async () => {
    nav.locale = "en";
    expect(readable(renderToStaticMarkup(await NotFound()))).toContain("Back to the library");
    nav.locale = "";
    expect(renderToStaticMarkup(await NotFound())).toContain('href="/en/app"');
  });
});
