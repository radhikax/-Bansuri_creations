import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Inline (empty) PostCSS config stops Vite searching parent folders and
  // loading the web app's postcss.config.mjs, whose Tailwind plugin isn't a
  // server dependency.
  css: { postcss: { plugins: [] } },
  test: {
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 30000,
    testTimeout: 15000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
