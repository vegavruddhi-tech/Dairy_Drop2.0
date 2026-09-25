import { redirect } from 'next/navigation';

import { getActor, gateStatus, toViewer } from '@/auth/session.js';
import { getT } from '@/i18n/server.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { AppShell } from '@/components/layout/AppShell.jsx';

export const dynamic = 'force-dynamic';

/**
 * Customer panel shell.
 *
 * Re-checks the role and the approval gate server-side. Middleware already did
 * this for navigation, but a layout must not assume middleware ran — that
 * assumption is what turns a convenience into a false sense of security.
 */
import {
  HomeIcon,
  CartIcon,
  OrdersIcon,
  CalendarIcon,
  PaymentsIcon,
  SubscriptionsIcon,
  ProfileIcon,
} from '@/components/ui/Icons.jsx';

export default async function CustomerLayout({ children }) {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  // Wrong area for this role — send them to their own home directly.
  if (actor.role !== ROLES.CUSTOMER) redirect(ROLE_HOME[actor.role] ?? '/');

  const gate = await gateStatus();
  if (!gate.ok) redirect(gate.redirect ?? '/pending');

  const t = await getT();

  const nav = [
    { href: '/dashboard', label: t('nav.home'), icon: <HomeIcon />, exact: true },
    { href: '/shop', label: t('nav.shop', {}, 'Shop'), icon: <CartIcon /> },
    { href: '/calendar', label: t('nav.calendar'), icon: <CalendarIcon /> },
    { href: '/billing', label: t('nav.billing'), icon: <PaymentsIcon /> },
  ];

  const more = [
    { href: '/orders', label: t('nav.orders', {}, 'Orders'), icon: <OrdersIcon /> },
    { href: '/subscriptions', label: t('nav.mySubscription'), icon: <SubscriptionsIcon /> },
    { href: '/profile', label: t('nav.profile'), icon: <ProfileIcon /> },
  ];

  return (
    <AppShell nav={nav} more={more} user={toViewer(actor)} title="DairyDrop">
      {children}
    </AppShell>
  );
}
