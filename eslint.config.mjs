import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "src/generated/**", "next-env.d.ts"]),
  { files: ["src/server/**/*.ts"], rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } },
  {
    files: ["src/components/**/*.tsx", "src/lib/store/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/server/**", "@/generated/**"], message: "Client code must access the backend through API routes." }] }]
    }
  }
]);
