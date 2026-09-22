'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary.
 *
 * Without one of these an uncaught render error produces a blank page — which
 * is exactly what happened when an admin landed on a customer URL: the layout
 * redirected while the page threw, and there was nothing to show the throw.
 *
 * Note this catches *render* errors only. Next handles `redirect()` and
 * `notFound()` itself; they never reach here.
 */
export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    // In production this is where a Sentry (or similar) capture belongs.
    console.error('[render error]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
        <p className="text-3xl" aria-hidden="true">⚠️</p>
        <h1 className="mt-3 text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {/*
            `error.message` is safe here: Next replaces it with a generic string
            in production and only exposes the real one in development.
          */}
          {error?.message ?? 'We could not load this page.'}
        </p>

        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink"
          >
            Try again
          </button>
          <a
            href="/"
            className="flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-ink"
          >
            Go home
          </a>
        </div>

        {error?.digest ? (
          <p className="mt-4 text-xs text-ink-subtle">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
