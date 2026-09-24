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
    /*
     * Runs once before any file. Clears fixture customers a crashed run left
     * behind — they are APPROVED, so they count against a milkman's plan limit
     * and can fail tests that never touched them.
     */
    globalSetup: ['./src/test/global-setup.js'],
    include: ['src/**/*.test.js', 'components/**/*.test.js'],
    // Integration tests share one database; running files in parallel would
    // have them trip over each other.
    fileParallelism: false,
    /*
     * Generous, because the integration suites talk to a real Postgres that is
     * usually in another region. A test that subscribes, generates a day of
     * deliveries and reads them back makes dozens of round trips, and at 30s
     * whichever test happened to run while the connection was busiest failed —
     * a different one each time, which reads like flakiness rather than
     * latency.
     */
    testTimeout: 60_000,
    // Setup hooks build fixtures — a customer, plans, a subscription, a day of
    // deliveries — so they make more round trips than the test that follows.
    // The 10s default is well under that against a remote database.
    hookTimeout: 60_000,
  },
});
