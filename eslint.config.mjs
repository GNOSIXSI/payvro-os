import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["packages/engine/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["convex", "convex/**", "next", "next/**", "@clerk/*", "@clerk/**"],
              message: "The engine is portable and cannot depend on application or backend packages.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "process", "fetch"],
    },
  },
  {
    files: ["app/**/*.{js,mjs,cjs,ts,tsx}", "components/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/packages/engine/src/pey/**"],
              message: "UI code must not import the pey adapter.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "convex/_generated/**",
  ]),
]);

export default eslintConfig;
