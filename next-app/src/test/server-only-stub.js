/**
 * Test stub for the `server-only` package.
 *
 * `server-only` throws unless it is resolved under React's `react-server`
 * export condition, which exists to stop a server module being pulled into a
 * client bundle. That guard is exactly right in the application and exactly
 * wrong in a test runner, which legitimately imports those modules directly.
 *
 * Aliased in vitest.config.js. It changes nothing about the real build — the
 * guard is still active everywhere the bundler resolves it.
 */
export {};
