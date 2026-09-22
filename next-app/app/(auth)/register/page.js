import { redirect } from 'next/navigation';

import { getActor } from '@/auth/session.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { RegisterFlow } from '@/components/customer/RegisterFlow.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

export const metadata = { title: 'Get started' };

/**
 * Registration.
 *
 * The account already exists — Auth.js created it on first Google sign-in with
 * PENDING approval. This screen supplies the details a milkman needs in order
 * to decide: which area, which address, and a phone number.
 */
export default async function RegisterPage() {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== ROLES.CUSTOMER) redirect(ROLE_HOME[actor.role] ?? '/');
  if (actor.tenantId) redirect('/pending');

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <PublicBar showBrand={true} />

      <header className="mb-8">
        <p className="text-sm font-medium text-brand">Almost there</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Find your milkman
        </h1>
        <p className="mt-1.5 text-ink-muted">
          Tell us where you live and we will show you who delivers there.
        </p>
      </header>

      <RegisterFlow defaultName={actor.name} />
    </main>
  );
}
