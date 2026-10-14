import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "src/generated/**", "next-env.d.ts"]),
  { files: ["src/server/**/*.ts"], rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } },
  {
    files: ["src/server/{repositories,controllers,services}/**/*.ts"],
    rules: {
      "@typescript-eslint/naming-convention": ["error",
        { selector: "function", format: ["snake_case"] },
        { selector: "objectLiteralMethod", format: ["snake_case"] },
      ],
      "no-restricted-syntax": ["error",
        {
          selector: "VariableDeclarator[id.name=/[A-Z]/][init.type='ArrowFunctionExpression']",
          message: "Backend functions use snake_case, such as create_user or validate_create_user.",
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.tsx", "src/lib/store/**/*.ts", "src/lib/measurement-form.ts", "src/types/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/server/**", "@/generated/**"], message: "Client code must use contracts from @/types and access the backend through API routes." }] }]
    }
  }
]);
