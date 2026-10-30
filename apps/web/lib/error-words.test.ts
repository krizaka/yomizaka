import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

// Bug #590: `errors.FLOW_NOT_OFFERED` had no words, so the page printed the raw key. Every code the API can answer has a sentence in both languages.
const ROOT = new URL("..", import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

/** The codes a handler refuses with (`refuse(403, "CODE", …)`), plus the ones a pure decision returns and a route turns into a refusal. */
const DECIDED = ["FLOW_NOT_OFFERED", "CONSENT_REQUIRED"];
const codes = (): string[] => {
  const found = new Set(DECIDED);
  for (const file of [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))])
    for (const m of readFileSync(file, "utf8").matchAll(/refuse\(\s*\d+,\s*"([A-Z][A-Z0-9_]+)"/g)) found.add(m[1]!);
  return [...found].sort();
};

describe("every error code has words", () => {
  it("finds the codes (the scan is not empty)", () => {
    expect(codes().length).toBeGreaterThan(50);
  });
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("%s: a sentence for each code", (_l, dict) => {
    const errors = dict.console.errors as Record<string, string>;
    expect(codes().filter((c) => !errors[c]?.trim())).toEqual([]);
  });
});
