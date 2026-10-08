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
    files: ["src/components/**/*.tsx", "src/lib/store/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: "^@/(?:server/(?!schema/(?:companies|roles|users)_schema$)|generated/)", message: "Client code must access the backend through API routes." }, { group: ["@/server/schema/companies_schema", "@/server/schema/roles_schema", "@/server/schema/users_schema"], allowTypeImports: true, message: "Schema contracts must be imported with import type." }] }]
    }
  }
]);
