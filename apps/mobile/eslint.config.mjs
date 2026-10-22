import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".expo/**", "dist/**", "ios/**", "android/**", "node_modules/**", "expo-env.d.ts"] },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
);
