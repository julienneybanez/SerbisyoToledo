import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Backend has its own vitest.config.js/environment; exclude it here so a
    // root `npm test` run does not also execute backend suites under jsdom.
    exclude: ['**/node_modules/**', 'backend/**'],
  },
});
