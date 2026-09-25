'use client';

import { SignOutButton } from '@clerk/nextjs';

export function SignOutAction({ children, redirectUrl = '/' }) {
  return (
    <SignOutButton redirectUrl={redirectUrl}>
      {children || (
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 underline hover:text-slate-800 transition-colors"
        >
          Sign out of account
        </button>
      )}
    </SignOutButton>
  );
}
