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
      <div className="mt-4">
        <RegisterFlow defaultName={actor.name} />
      </div>
    </main>
  );
}
