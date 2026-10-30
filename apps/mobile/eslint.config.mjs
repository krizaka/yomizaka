import { krizakaBase } from "@krizaka/config/eslint";

const jestGlobals = Object.fromEntries(
  ["jest", "describe", "it", "test", "expect", "beforeAll", "beforeEach", "afterAll", "afterEach"].map((name) => [
    name,
    "readonly",
  ]),
);

export default [
  ...krizakaBase,
  { ignores: ["ios/**", "android/**", "expo-env.d.ts"] },
  { files: ["**/*.test.{ts,tsx}", "**/__tests__/**", "**/__mocks__/**"], languageOptions: { globals: jestGlobals } },
  // Expo config plugins and their tests are CommonJS.
  {
    files: ["plugins/**/*.js", "jest.resolver.js", ".dependency-cruiser.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];
