import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireMilkman } from '@/auth/session.js';
import { gateStatus } from '@/auth/session.js';
import { GATE } from '@/auth/policy.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as saasService from '@/services/saas.service.js';
import * as usersRepo from '@/repositories/users.repo.js';

import { Card, CardBody, CardHeader } from '@/components/ui/index.jsx';
import { StartTrial, SubmitSaasPayment } from '@/components/milkman/Activate.jsx';
import { VerificationStatusChecker } from '@/components/milkman/VerificationStatusChecker.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';
import { BackgroundParticles } from '@/components/ui/BackgroundParticles.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activate Dairy Panel • DairyDrop' };

/**
 * The milkman activation & verification screen (Blue & White Design System).
 * Fully responsive with live 10s auto-status polling, manual status refresh button,
 * and clear onboarding state.
 */
export default async function ActivatePage() {
  const actor = await requireMilkman({ allowUnpaid: true });
  const gate = await gateStatus();

  // Everything is in order — go to the panel directly.
  if (gate.ok) redirect('/milkman');

  const profile = await usersRepo.findMilkmanProfile(actor.userId);
  const user = await usersRepo.findUserById(actor.userId);

  // Only fetch membership if past the initial milkman verification
  let membership = null;
  if (gate.gate !== GATE.MILKMAN_UNVERIFIED) {
    try {
      membership = await saasService.getMembership(actor);
    } catch (err) {
      console.warn('Could not fetch membership:', err);
    }
  }

  return (
    <div className="relative min-h-dvh bg-[#fafcff] text-slate-900 pb-16 overflow-x-hidden">
      <BackgroundParticles count={24} />
      <PublicBar showBrand={true} />

      <main className="mx-auto max-w-2xl px-5 pt-8 pb-16 animate-fade-in">
        <header className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            DairyDrop for Milkmen & Dairies
          </span>
          <h1 className="mt-3 font-heading text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {gate.gate === GATE.MILKMAN_UNVERIFIED
              ? 'Verifying Your Dairy Business'
              : gate.gate === GATE.SAAS_PENDING_VERIFICATION
                ? 'Checking Your Payment'
                : 'Activate Your Vendor Panel'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">{gate.message}</p>
        </header>

        {/* ── Waiting on Admin Verification ───────────────────────────── */}
        {gate.gate === GATE.MILKMAN_UNVERIFIED ? (
          <Card className="border border-slate-200/90 shadow-xl shadow-blue-500/5 bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden">
            <CardBody className="space-y-5 text-center p-6 sm:p-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
                <svg className="h-8 w-8 fill-current animate-pulse" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>

              <div>
                <h2 className="font-heading text-xl font-bold text-slate-900">
                  Verification in Progress
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                  We check every dairy business before it goes live to verify local supply legitimacy. This usually takes a few hours.
                </p>
              </div>

              {/* Real-time 10s Auto-poller and Manual Check Button */}
              <VerificationStatusChecker
                initialGate={gate.gate}
                initialMessage={gate.message}
                businessName={profile?.businessName}
                phone={user?.phone}
                targetRedirect="/milkman"
              />

              {/* Need Quick Approval / Support note */}
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 text-xs text-slate-600 text-left flex items-start gap-2.5">
                <svg className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                <div className="leading-relaxed">
                  <span className="font-bold text-slate-900">Need urgent activation?</span> Our team verifies registered dairies between 8:00 AM and 8:00 PM IST daily.
                </div>
              </div>
            </CardBody>
          </Card>
        ) : gate.gate === GATE.SAAS_PENDING_VERIFICATION ? (
          <Card className="border border-blue-200 shadow-xl shadow-blue-500/5 bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden">
            <CardBody className="space-y-5 p-6 sm:p-8">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <p className="font-heading text-base font-bold text-blue-900">
                  Payment Received, Verifying Reference
                </p>
                <p className="mt-1 text-xs text-blue-700 leading-relaxed">
                  We are matching your reference against our bank statement. Your vendor panel opens as soon as it clears.
                </p>
              </div>

              {membership && (
                <dl className="grid gap-3 sm:grid-cols-3 rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-xs">
                  <div>
                    <dt className="text-slate-500 font-medium">Selected Plan</dt>
                    <dd className="font-heading text-sm font-bold text-slate-900 mt-0.5">{membership.current?.planName || 'Growth'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Payment Reference (UTR)</dt>
                    <dd className="font-mono text-xs font-bold text-slate-900 mt-0.5">{membership.current?.paymentReference || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Amount Paid</dt>
                    <dd className="font-heading text-sm font-bold text-blue-600 mt-0.5">
                      {membership.current?.pricePaid ? formatPaise(toPaise(membership.current.pricePaid)) : '—'}
                    </dd>
                  </div>
                </dl>
              )}

              {/* Status Poller */}
              <VerificationStatusChecker
                initialGate={gate.gate}
                initialMessage={gate.message}
                businessName={profile?.businessName}
                phone={user?.phone}
                targetRedirect="/milkman"
              />
            </CardBody>
          </Card>
        ) : membership ? (
          <>
            {/* ── Trial ─────────────────────────────────────────────────── */}
            {!membership.trialUsed ? (
              <Card className="mb-6 border-2 border-blue-200 shadow-lg shadow-blue-500/5 bg-white rounded-3xl overflow-hidden">
                <CardHeader
                  title="Start with 7 Days Free"
                  description={`Manage up to ${membership.settings?.trialCustomerLimit || 25} customers. Zero card, no payment needed.`}
                  action={<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Free Trial</span>}
                />
                <CardBody className="p-6">
                  <StartTrial />
                </CardBody>
              </Card>
            ) : null}

            {/* ── Plans ─────────────────────────────────────────────────── */}
            <section className="mb-6" aria-labelledby="plans-heading">
              <h2 id="plans-heading" className="mb-3 font-heading text-base font-bold text-slate-900">
                {membership.trialUsed ? 'Choose a Subscription Plan' : 'Or Choose a Plan Directly'}
              </h2>

              <div className="grid gap-4 sm:grid-cols-3">
                {(membership.plans || []).map((plan) => (
                  <Card key={plan.id} className="border border-slate-200/90 shadow-sm bg-white hover:border-blue-600 transition-all rounded-2xl overflow-hidden">
                    <CardBody className="flex h-full flex-col justify-between gap-3 p-5">
                      <div>
                        <p className="font-heading font-bold text-slate-900 text-base">{plan.name}</p>
                        <div className="mt-2">
                          <span className="font-heading text-2xl font-black text-blue-600">
                            {formatPaise(toPaise(plan.monthlyPrice), { whole: true })}
                          </span>
                          <span className="ml-1 text-xs text-slate-500 font-medium">/ month</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          Up to {plan.maxCustomers} customers
                        </p>
                        <ul className="mt-3 space-y-1 text-xs text-slate-600">
                          {(plan.features ?? []).map((feature) => (
                            <li key={feature} className="flex items-center gap-1.5">
                              <span className="text-blue-600 font-bold">✓</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── Pay ───────────────────────────────────────────────────── */}
            <SubmitSaasPayment plans={membership.plans || []} settings={membership.settings || {}} />
          </>
        ) : null}
      </main>
    </div>
  );
}
