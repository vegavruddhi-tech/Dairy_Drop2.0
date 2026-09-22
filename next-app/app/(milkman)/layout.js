import { redirect } from 'next/navigation';

import { getActor, gateStatus, toViewer } from '@/auth/session.js';
import { getT } from '@/i18n/server.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { isRecoverable } from '@/auth/policy.js';
import { AppShell } from '@/components/layout/AppShell.jsx';
import * as requestsRepo from '@/repositories/requests.repo.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as billingRepo from '@/repositories/billing.repo.js';

/**
 * Milkman panel shell.
 *
 * The paywall is enforced here **and** inside every Server Action. The layout
 * check keeps a lapsed milkman out of the UI; the action check is what actually
 * protects the data, because actions are callable directly.
 */
export default async function MilkmanLayout({ children }) {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  // Wrong area for this role — send them to their own home directly.
  if (actor.role !== ROLES.MILKMAN) redirect(ROLE_HOME[actor.role] ?? '/');

  const gate = await gateStatus();

  // A lapsed milkman may still reach the activation screen to fix it. That page
  // has its own layout, so anything else redirects there.
  if (!gate.ok) {
    redirect(isRecoverable(gate.gate) ? '/milkman/activate' : '/sign-in');
  }

  const [requests, pendingCustomers, pendingPayments] = await Promise.all([
    requestsRepo.countPendingRequests(actor),
    usersRepo.countPendingCustomers(actor),
    billingRepo.countSubmitted(actor),
  ]);

  const t = await getT();

  const nav = [
    { href: '/milkman', label: t('nav.home'), icon: '🏠', exact: true },
    { href: '/milkman/round', label: t('nav.deliveries', {}, 'Round'), icon: '🚲' },
    { href: '/milkman/customers', label: t('nav.customers'), icon: '👥', count: pendingCustomers },
    { href: '/milkman/requests', label: t('nav.requests'), icon: '✋', count: requests.total },
  ];

  const more = [
    { href: '/milkman/orders', label: 'Orders', icon: '📦' },
    { href: '/milkman/catalog', label: 'Catalog', icon: '🧈' },
    { href: '/milkman/plans', label: 'Milk plans', icon: '📋' },
    { href: '/milkman/payments', label: 'Payments', icon: '₹', count: pendingPayments },
    { href: '/milkman/earnings', label: 'Earnings', icon: '📈' },
    { href: '/milkman/membership', label: 'Membership', icon: '⭐' },
  ];

  return (
    <AppShell nav={nav} more={more} user={toViewer(actor)} title="Milkman" badge="Milkman">
      {children}
    </AppShell>
  );
}
