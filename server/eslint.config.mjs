import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // Express recognizes an error-handling middleware by its arity (4 params).
      // `_next` in src/app.ts must stay a required positional parameter even
      // though it's unused, so it keeps the `_` prefix instead of being removed.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
