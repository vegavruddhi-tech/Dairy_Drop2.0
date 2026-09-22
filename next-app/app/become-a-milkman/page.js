import { redirect } from 'next/navigation';

import { getActor } from '@/auth/session.js';
import { ROLES } from '@/auth/roles.js';
import { PublicBar } from '@/components/layout/PublicBar.jsx';
import { MilkmanApplicationForm } from '@/components/milkman/ApplicationForm.jsx';

export const metadata = { title: 'Sell on DairyDrop' };

/**
 * The milkman application.
 *
 * This is the piece that was missing: the platform's own documentation said a
 * milkman is provisioned deliberately rather than self-served, but nothing
 * actually did the provisioning — so anyone signing up to sell became a
 * customer, and no application ever reached an administrator.
 */
export default async function BecomeMilkmanPage() {
  const actor = await getActor();

  // Signing in first means the application attaches to a real, verified
  // identity rather than an anonymous form submission.
  if (!actor) redirect('/sign-in?next=/become-a-milkman');
  if (actor.role === ROLES.MILKMAN) redirect('/milkman/activate');
  if (actor.role === ROLES.ADMIN) redirect('/admin');

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <PublicBar showBrand />

      <header className="mb-7 mt-10">
        <p className="text-sm font-bold text-brand">For milkmen</p>
        <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-ink">
          Sell on DairyDrop
        </h1>
        <p className="mt-1.5 text-sm font-medium text-ink-muted">
          Tell us about your dairy. We check every business before it goes live,
          so customers know who they are buying from. It usually takes a working day.
        </p>
      </header>

      <MilkmanApplicationForm defaultName={actor.name} />
    </main>
  );
}
