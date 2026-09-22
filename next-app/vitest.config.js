import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Two suites share this config:
 *
 *   · unit        pure domain logic, no I/O — always runs
 *   · integration the data layer against a real database — skipped without
 *                 DATABASE_URL, so a machine with no Postgres still passes
 *
 * The `@/` alias has to be declared here as well as in jsconfig.json: the
 * former is what the bundler and the editor read, this is what the test runner
 * reads.
 */
export default defineConfig({
  resolve: {
    // Order matters: Vite matches aliases by prefix, in declaration order, so
    // the more specific '@/components' has to come before the bare '@'.
    alias: {
      '@/components': fileURLToPath(new URL('./components', import.meta.url)),
      '@/app': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Server modules guard themselves with `server-only`, which throws
      // outside a React Server Component graph. The test runner is a
      // legitimate direct consumer; stub the guard for it alone.
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.js', import.meta.url)),
    },
  },
  // Component tests import .jsx directly; use React's automatic runtime so
  // they need no explicit React import.
  esbuild: { jsx: 'automatic' },

  test: {
    environment: 'node',
    // Vitest only auto-loads VITE_-prefixed variables; the integration suite
    // needs DATABASE_URL, so load .env into every test context.
    setupFiles: ['dotenv/config'],
    include: ['src/**/*.test.js', 'components/**/*.test.js'],
    // Integration tests share one database; running files in parallel would
    // have them trip over each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
