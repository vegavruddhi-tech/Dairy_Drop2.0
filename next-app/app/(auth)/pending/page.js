import { redirect } from 'next/navigation';

import { getActor, gateStatus } from '@/auth/session.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { GATE } from '@/auth/policy.js';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';

import { Card, CardBody } from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

export const metadata = { title: 'Awaiting approval' };

/**
 * The holding screen for a customer who is not yet approved.
 *
 * It polls nothing and issues no token. The previous system's equivalent called
 * a public endpoint that minted a 7-day JWT from an email address alone.
 */
export default async function PendingPage() {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== ROLES.CUSTOMER) redirect(ROLE_HOME[actor.role] ?? '/');

  const gate = await gateStatus();
  if (gate.ok) redirect('/dashboard');
  if (gate.gate === GATE.CUSTOMER_UNASSIGNED) redirect('/register');

  const rejected = gate.gate === GATE.CUSTOMER_REJECTED;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <PublicBar showBrand={true} />

      <Card>
        <CardBody className="space-y-4 text-center">
          <div className="text-4xl" aria-hidden="true">{rejected ? '😔' : '⏳'}</div>
          <h1 className="text-lg font-semibold text-ink">
            {rejected ? 'Registration declined' : 'Waiting for approval'}
          </h1>
          <p className="text-sm text-ink-muted">{gate.message}</p>

          {rejected ? (
            <Link href="/register">
              <Button className="w-full">Choose another milkman</Button>
            </Link>
          ) : (
            <p className="text-xs text-ink-subtle">
              Refresh this page once your milkman has approved you.
            </p>
          )}

          {/*
            Someone who signed up meaning to *sell* lands here as a pending
            customer with no obvious way out. This is that way out — it was the
            trap the reporter fell into.
          */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-ink-muted">
              Did you mean to sell milk rather than buy it?
            </p>
            <Link href="/become-a-milkman">
              <Button variant="outline" size="sm" className="mt-2 w-full">
                Apply as a milkman
              </Button>
            </Link>
          </div>

          <SignOutButton>
            <button type="button" className="block w-full text-sm text-ink-muted underline">
              Sign out
            </button>
          </SignOutButton>
        </CardBody>
      </Card>
    </main>
  );
}
