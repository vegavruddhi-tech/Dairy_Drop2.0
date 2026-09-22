import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInButton, SignUpButton, Show } from '@clerk/nextjs';

import { getActor } from '@/auth/session.js';
import { ROLE_HOME } from '@/auth/roles.js';
import { Button } from '@/components/ui/interactive.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

/**
 * Marketing root. Anyone signed in is sent to their panel by middleware; this
 * check is the belt to that braces, for the case where middleware is skipped.
 */
export default async function LandingPage() {
  const actor = await getActor();
  if (actor) redirect(ROLE_HOME[actor.role] ?? '/sign-in');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <PublicBar showBrand={false} />

      <p className="text-sm font-medium text-brand">DairyDrop</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Fresh milk, every morning.
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Subscribe to a daily delivery from a milkman near you. Skip a day whenever
        you like — you only pay for what actually arrives.
      </p>

      {/*
        Clear auth controls, so a first-time visitor can see how to get in.
        <Show> renders on the client from Clerk's session state; the redirect
        above handles the server-rendered case.
      */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Show when="signed-out">
          <SignUpButton mode="modal">
            <Button size="lg">Get started</Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </SignInButton>
        </Show>

        <Show when="signed-in">
          <Link href="/dashboard">
            <Button size="lg">Open my account</Button>
          </Link>
        </Show>

        <Link href="/pricing">
          <Button size="lg" variant="ghost">
            Sell on DairyDrop
          </Button>
        </Link>
      </div>

      <dl className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          ['Pay for what arrives', 'Skipped days cost nothing. No fixed monthly charge.'],
          ['Change any day', 'Need two litres tomorrow? Change just that day.'],
          ['One clear bill', 'Milk and extras on a single monthly statement.'],
        ].map(([term, description]) => (
          <div key={term}>
            <dt className="text-sm font-semibold text-ink">{term}</dt>
            <dd className="mt-1 text-sm text-ink-muted">{description}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
