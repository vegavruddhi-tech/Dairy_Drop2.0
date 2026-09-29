import { SignOutButton } from '@clerk/nextjs';

import { MilkDropIcon } from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Account locked' };

/**
 * Shown when the email someone signed in with is already bound to a different,
 * still-existing sign-in. Deliberately does not call `getActor` — that is what
 * sent them here, and calling it again would redirect in a loop.
 */
export default function AccountLockedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="card-surface p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-caution-soft text-caution">
          <MilkDropIcon className="h-6 w-6" />
        </div>
        <h1 className="mt-3 font-heading text-lg font-extrabold text-ink">This account is linked elsewhere</h1>
        <p className="mt-1.5 text-sm font-medium text-ink-muted">
          The email you signed in with already belongs to another DairyDrop sign-in. To keep that
          account safe we have not opened it here. Sign in the way you did before, or contact
          support to have it moved to this sign-in.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <button
            type="button"
            className="tap mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink"
          >
            Sign out and try again
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}
