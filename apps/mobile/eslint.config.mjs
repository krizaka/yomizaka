import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".expo/**", "dist/**", "ios/**", "android/**", "node_modules/**", "expo-env.d.ts"] },
  ...tseslint.configs.recommended,
  // Expo config plugins and their tests are CommonJS.
  { files: ["plugins/**/*.js", "jest.resolver.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
);
