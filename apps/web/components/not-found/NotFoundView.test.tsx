import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NotFoundView } from "./NotFoundView";

describe("the 404 page", () => {
  it("renders in French for /fr/nope", () => {
    const html = renderToStaticMarkup(<NotFoundView locale="fr" />);
    expect(html).toContain("404");
    expect(html).toContain("Cette page n&#x27;existe pas.");
    expect(html).toContain("Accueil");
    expect(html).toContain('href="/fr"');
    expect(html).toContain("<svg");
    expect(html).not.toContain("This page does not exist");
  });

  it("renders in English", () => {
    const html = renderToStaticMarkup(<NotFoundView locale="en" />);
    expect(html).toContain("This page does not exist.");
    expect(html).toContain('href="/en"');
  });
});
