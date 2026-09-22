import { redirect } from 'next/navigation';

import { getActor, toViewer } from '@/auth/session.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { AppShell } from '@/components/layout/AppShell.jsx';
import * as saasRepo from '@/repositories/saas.repo.js';
import * as onboardingService from '@/services/onboarding.service.js';

export default async function AdminLayout({ children }) {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  // Wrong area for this role — send them to their own home directly.
  if (actor.role !== ROLES.ADMIN) redirect(ROLE_HOME[actor.role] ?? '/');

  const [verifications, applications] = await Promise.all([
    saasRepo.listPendingVerifications(),
    onboardingService.countPendingMilkmanApplications(),
  ]);

  const nav = [
    { href: '/admin', label: 'Overview', icon: '📊', exact: true },
    { href: '/admin/milkmen', label: 'Milkmen', icon: '👥', count: applications },
    { href: '/admin/verifications', label: 'Verify', icon: '✅', count: verifications.length },
    { href: '/admin/payments', label: 'Payments', icon: '₹' },
  ];

  const more = [
    { href: '/admin/plans', label: 'Plans', icon: '📋' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
    { href: '/admin/audit', label: 'Audit log', icon: '📜' },
  ];

  return (
    <AppShell nav={nav} more={more} user={toViewer(actor)} title="Admin" badge="Admin">
      {children}
    </AppShell>
  );
}
