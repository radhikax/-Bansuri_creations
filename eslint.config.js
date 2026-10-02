import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      '.next/',
      'server/',
      '.claude/',
      '.superpowers/',
      // Vendored shadcn/ui kit and Figma template, already excluded from coverage.
      'src/components/ui/**',
      'src/components/figma/**',
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
      // Destructuring a prop solely to drop it before spreading `...rest`
      // (e.g. next/image props a plain <img> test double can't use) is
      // intentionally unused — the leading underscore signals that.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    files: ['e2e/**/*.ts', '*.config.{js,ts}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
