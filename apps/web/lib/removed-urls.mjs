/** @typedef {{ source: string, destination: string, permanent: true }} RemovedRule */

/**
 * The public addresses this site no longer serves, and where each one went (Simplify Yomizaka, krizaka/yomizaka#120).
 * Every one answers 308: with the language prefix, and without it. next.config.mjs reads `redirectRules()`;
 * lib/menu.test.ts checks them. A removed page never comes back: change the home instead.
 */

/** The audience landings of the old site, by language: the product is one, so they lead to the home. */
export const OLD_AUDIENCE_SLUGS = ["tenant", "landlord", "freelancer", "business", "locataire", "proprietaire", "travailleur-autonome", "entreprise"];

/** Old path (after the language) -> the section or page of the new site it went to. */
const MOVED = {
  "/run": "#proof",
  "/changelog": "",
  "/changelog/feed.xml": "",
  ...Object.fromEntries(OLD_AUDIENCE_SLUGS.map((s) => [`/${s}`, ""])),
};

/** @returns {RemovedRule[]} */
export function redirectRules() {
  const rules = [];
  for (const [path, to] of Object.entries(MOVED)) {
    for (const locale of ["en", "fr"]) rules.push({ source: `/${locale}${path}`, destination: `/${locale}${to}`, permanent: true });
    // No language in the address: the home chooses the visitor's language itself.
    rules.push({ source: path, destination: `/${to}`, permanent: true });
  }
  return rules;
}
