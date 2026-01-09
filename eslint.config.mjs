// ESLint 9+ flat config для Next.js 15
// Простая конфигурация для TypeScript

import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "**/*.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Отключаем строгие правила для разработки
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "off", // require() используется для динамической загрузки fs
      "no-console": "off",
    },
  },
];

export default eslintConfig;
