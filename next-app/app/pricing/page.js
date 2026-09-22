import Link from 'next/link';

import { formatPaise, toPaise } from '@/domain/money.js';
import * as saasRepo from '@/repositories/saas.repo.js';
import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

export const metadata = { title: 'Pricing for milkmen' };

/**
 * Reads live plan data, so it is rendered per request rather than prerendered
 * at build time — a build must not require a database connection.
 */
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const plans = await saasRepo.listActiveSaasPlans();
  const settings = await saasRepo.getPlatformSettings();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <PublicBar showBrand={false} />

      <header className="mb-10 text-center">
        <p className="text-sm font-medium text-brand">DairyDrop for milkmen</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Run your round from your phone
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          Track every delivery, bill your customers automatically, and know exactly
          who owes what. Start with {settings.trialDurationDays} days free.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardBody className="flex h-full flex-col gap-3">
              <p className="font-medium text-ink">{plan.name}</p>
              <div>
                <span className="text-3xl font-semibold tnum text-ink">
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
              <div className="mt-auto pt-2">
                <Link href="/become-a-milkman">
                  <Button className="w-full" variant="outline">Apply with this plan</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/become-a-milkman">
          <Button size="lg">Apply to sell on DairyDrop</Button>
        </Link>
        <p className="mt-3 text-sm font-medium text-ink-muted">
          Every plan includes the full app. Plans differ only by how many customers
          you serve. We verify every business before it goes live.
        </p>
      </div>
    </main>
  );
}
