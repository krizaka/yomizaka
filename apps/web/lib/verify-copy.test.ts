import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import sitemap from "../app/sitemap";
import { llmsText } from "./seo";
import { safeNext } from "./site";

/** ADR-0002: no copy may promise public verification again. */
const strings = (value: unknown, path = ""): [string, string][] =>
  typeof value === "string" ? [[path, value]] : value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k)) : [];

const BANNED = [/n['’]importe qui/i, /anyone (can|may) (verify|check)/i, /by anyone, without an account/i, /\bsans compte\b/i, /without an account/i, /no account (needed|required)/i, /anybody/i];

describe("verification copy — members with a grant only", () => {
  for (const [name, catalogue] of [["en", en], ["fr", fr]] as const) {
    it(`${name}: no « anyone can verify » is left in the catalogue`, () => {
      const hits = strings(catalogue).filter(([, text]) => BANNED.some((re) => re.test(text)));
      expect(hits).toEqual([]);
    });
  }

  it("the landing card says only the people given access can verify, with a Yomizaka account", () => {
    expect(fr.landing.how.steps.prove.text).toMatch(/seules les personnes à qui vous donnez accès peuvent le vérifier, avec un compte Yomizaka/);
    expect(en.landing.how.steps.prove.text).toMatch(/only the people you give access to can verify it, with a Yomizaka account/);
  });

  it("llms.txt says there is no public verification", () => {
    expect(llmsText()).toMatch(/no public verification/);
  });

  it("the sitemap does not list the members-only /verify", async () => {
    expect((await sitemap()).filter((e) => e.url.includes("/verify"))).toEqual([]);
  });
});

describe("safeNext — sign-in returns to a page of this site, nothing else", () => {
  it("keeps a path in the page's language", () => expect(safeNext("/fr/verify", "fr")).toBe("/fr/verify"));
  it("falls back to the library otherwise", () => {
    for (const bad of [undefined, "", "https://evil.test", "//evil.test", "/en/verify", "/fr//evil.test", "/fr/\\evil", "/fr/a\nb"]) {
      expect(safeNext(bad, "fr")).toBe(bad === "/fr//evil.test" ? "/fr//evil.test" : "/fr/app");
    }
  });
});
