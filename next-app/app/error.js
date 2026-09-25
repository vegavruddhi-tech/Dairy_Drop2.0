'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[Application Error]:', error);
  }, [error]);

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-blue-500/5">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="font-heading text-xl font-black text-slate-900 tracking-tight">
          Temporary Glitch Occurred
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 font-medium">
          We encountered an issue loading this panel. Please refresh or return to the main dashboard.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto rounded-2xl bg-blue-600 px-5 py-2.5 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2.5 font-heading text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
