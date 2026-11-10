import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 无障碍：在 eslint-config-next 自带的几条之外，打开 jsx-a11y 的推荐规则
  {
    files: ["**/*.{jsx,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
