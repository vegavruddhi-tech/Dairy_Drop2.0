import { redirect } from 'next/navigation';

import { getActor } from '@/auth/session.js';
import { ROLES } from '@/auth/roles.js';
import { PublicBar } from '@/components/layout/PublicBar.jsx';
import { MilkmanApplicationForm } from '@/components/milkman/ApplicationForm.jsx';
import { BackgroundParticles } from '@/components/ui/BackgroundParticles.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Milkman Registration • DairyDrop' };

export default async function BecomeMilkmanPage() {
  const actor = await getActor();

  if (!actor) redirect('/sign-in?next=/become-a-milkman');
  if (actor.role === ROLES.MILKMAN) redirect('/milkman/activate');
  if (actor.role === ROLES.ADMIN) redirect('/admin');

  return (
    <div className="relative min-h-dvh bg-[#fafcff] text-slate-900 pb-16 overflow-x-hidden">
      <BackgroundParticles count={24} />
      <PublicBar showBrand />

      <main className="mx-auto max-w-lg px-5 pt-8 pb-16 animate-fade-in">
        <header className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            For Milkmen & Dairies • Vendor Registration
          </span>
          <h1 className="mt-3 font-heading text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Sell on DairyDrop
          </h1>
          <p className="mt-1.5 text-xs text-slate-600 sm:text-sm leading-relaxed">
            Tell us about your dairy business. We verify every business before going live. It usually takes less than 24 hours.
          </p>
        </header>

        <MilkmanApplicationForm defaultName={actor.name} />
      </main>
    </div>
  );
}
