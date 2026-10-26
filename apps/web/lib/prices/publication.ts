/**
 * Whether the public price page is published (yomizaka#388). HELD: the page reads the catalogue and is ready, but prices are
 * not shown to the public before Oussama's OK on the grid (yomizaka#300). While this is false, `/pricing` answers 404 and
 * the page is in neither the bar, the footer, the sitemap nor llms.txt. The OK is one line: this constant, in the pull request
 * that records it. `lib/prices/publication.test.ts` keeps every surface in step with it.
 */
export const PRICING_PUBLISHED = false;
