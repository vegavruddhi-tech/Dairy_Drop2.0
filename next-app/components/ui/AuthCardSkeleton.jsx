import React from 'react';

/**
 * Fast visual loading skeleton rendered instantly while Clerk initializes.
 * Prevents the blank white delay.
 */
export function AuthCardSkeleton({ isSignUp = false }) {
  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-xl shadow-blue-500/5 backdrop-blur-md animate-pulse">
      {/* Skeleton Header */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="h-4 w-32 rounded-full bg-slate-200" />
        <div className="h-3 w-48 rounded-full bg-slate-100" />
      </div>

      {/* Google Button Skeleton */}
      <div className="h-11 w-full rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center gap-2 mb-4">
        <div className="h-4 w-4 rounded-full bg-slate-300" />
        <div className="h-3 w-36 rounded-md bg-slate-200" />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2 my-5">
        <div className="h-[1px] flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase">or</span>
        <div className="h-[1px] flex-1 bg-slate-100" />
      </div>

      {/* Form Input Skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="h-11 w-full rounded-xl bg-slate-50 border border-slate-200" />
        <div className="h-11 w-full rounded-xl bg-blue-600/30 mt-4 flex items-center justify-center">
          <div className="h-3.5 w-20 rounded bg-white/70" />
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-6 flex justify-center">
        <div className="h-3 w-40 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}
