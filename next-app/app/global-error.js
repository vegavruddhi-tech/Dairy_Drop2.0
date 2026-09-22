'use client';

/**
 * Last-resort boundary, for an error thrown by the root layout itself.
 *
 * It must render its own <html> and <body>, because the layout that would
 * normally provide them is the thing that failed. Styling is inline for the
 * same reason — the stylesheet may not have loaded.
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <div style={{ maxWidth: '24rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>DairyDrop is unavailable</h1>
          <p style={{ marginTop: '0.5rem', color: '#57534e', fontSize: '0.875rem' }}>
            Something failed while loading the application. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.25rem',
              height: '2.75rem',
              padding: '0 1rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#059669',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
