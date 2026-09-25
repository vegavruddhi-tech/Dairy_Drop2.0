import { redirect } from 'next/navigation';

import { getActor } from '@/auth/session.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { RegisterFlow } from '@/components/customer/RegisterFlow.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';
import { BackgroundParticles } from '@/components/ui/BackgroundParticles.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Get Started • DairyDrop' };

export default async function RegisterPage() {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== ROLES.CUSTOMER) redirect(ROLE_HOME[actor.role] ?? '/');
  // If already registered and pending/approved, send to pending/dashboard; allow REJECTED customers to re-apply
  if (actor.tenantId && actor.approvalStatus !== 'REJECTED') redirect('/pending');

  return (
    <div className="relative min-h-dvh bg-[#fafcff] text-slate-900 pb-16 overflow-x-hidden">
      <BackgroundParticles count={24} />
      <PublicBar showBrand={true} />
      <main className="mx-auto max-w-xl px-5 pt-8 pb-12 animate-fade-in">
        <RegisterFlow defaultName={actor.name} />
      </main>
    </div>
  );
}
