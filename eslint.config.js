import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'server/',
      '.claude/',
      '.superpowers/',
      // Vendored shadcn/ui kit and Figma template, already excluded from coverage.
      'src/app/components/ui/**',
      'src/app/components/figma/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
