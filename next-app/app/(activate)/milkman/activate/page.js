import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';

import { requireMilkman } from '@/auth/session.js';
import { gateStatus } from '@/auth/session.js';
import { GATE } from '@/auth/policy.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as saasService from '@/services/saas.service.js';

import { Card, CardBody, CardHeader, Badge, Notice, Field } from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { StartTrial, SubmitSaasPayment } from '@/components/milkman/Activate.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

export const metadata = { title: 'Activate' };

/**
 * The paywall screen.
 *
 * It must say precisely *which* gate is closed — "you need a subscription" is
 * useless when the real answer is "an admin has not verified your business yet"
 * or "we are still checking your payment".
 */
export default async function ActivatePage() {
  const actor = await requireMilkman({ allowUnpaid: true });
  const gate = await gateStatus();

  // Everything is in order — go to the panel.
  if (gate.ok) redirect('/milkman');

  const membership = await saasService.getMembership(actor);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <PublicBar showBrand={true} />

      <header className="mb-8">
        <p className="text-sm font-medium text-brand">DairyDrop for milkmen</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {gate.gate === GATE.MILKMAN_UNVERIFIED
            ? 'Verifying your business'
            : gate.gate === GATE.SAAS_PENDING_VERIFICATION
              ? 'Checking your payment'
              : 'Open your panel'}
        </h1>
        <p className="mt-1.5 text-ink-muted">{gate.message}</p>
      </header>

      {/* ── Waiting on us ─────────────────────────────────────────────── */}
      {gate.gate === GATE.MILKMAN_UNVERIFIED ? (
        <Card>
          <CardBody className="space-y-4 text-center">
            <div className="text-4xl" aria-hidden="true">⏳</div>
            <p className="text-sm text-ink-muted">
              We check every business before it goes live, so customers know who
              they are buying from. This usually takes a working day.
            </p>
            <SignOutButton>
              <button type="button" className="block w-full text-sm text-ink-muted underline">
                Sign out
              </button>
            </SignOutButton>
          </CardBody>
        </Card>
      ) : gate.gate === GATE.SAAS_PENDING_VERIFICATION ? (
        <Card>
          <CardBody className="space-y-4">
            <Notice tone="caution" title="Payment received, not yet confirmed">
              We are matching your reference against our bank statement. Your
              panel opens as soon as it clears.
            </Notice>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Plan" value={membership.current?.planName} />
              <Field label="Reference" value={membership.current?.paymentReference} />
              <Field
                label="Amount"
                value={membership.current?.pricePaid ? formatPaise(toPaise(membership.current.pricePaid)) : '—'}
              />
            </dl>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* ── Trial ─────────────────────────────────────────────────── */}
          {!membership.trialUsed ? (
            <Card className="mb-6 border-brand">
              <CardHeader
                title="Start with 7 days free"
                description={`Up to ${membership.settings.trialCustomerLimit} customers. No card, no payment.`}
                action={<Badge tone="brand">Free</Badge>}
              />
              <CardBody>
                <StartTrial />
              </CardBody>
            </Card>
          ) : null}

          {/* ── Plans ─────────────────────────────────────────────────── */}
          <section className="mb-6" aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="mb-3 text-sm font-semibold text-ink">
              {membership.trialUsed ? 'Choose a plan' : 'Or go straight to a plan'}
            </h2>

            <div className="grid gap-3 sm:grid-cols-3">
              {membership.plans.map((plan) => (
                <Card key={plan.id}>
                  <CardBody className="flex h-full flex-col gap-3">
                    <p className="font-medium text-ink">{plan.name}</p>
                    <div>
                      <span className="text-2xl font-semibold tnum text-ink">
                        {formatPaise(toPaise(plan.monthlyPrice), { whole: true })}
                      </span>
                      <span className="ml-1 text-sm text-ink-muted">/ month</span>
                    </div>
                    <p className="text-sm text-ink-muted">
                      Up to <strong className="text-ink">{plan.maxCustomers}</strong> customers
                    </p>
                    <ul className="space-y-1 text-sm text-ink-muted">
                      {(plan.features ?? []).map((feature) => (
                        <li key={feature}>· {feature}</li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          {/* ── Pay ───────────────────────────────────────────────────── */}
          <SubmitSaasPayment plans={membership.plans} settings={membership.settings} />
        </>
      )}
    </main>
  );
}
