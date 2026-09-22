import { redirect } from 'next/navigation';

import { getActor } from '@/auth/session.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';

/**
 * A bare shell for the activation screen.
 *
 * Deliberately outside the milkman panel layout: that layout redirects a lapsed
 * milkman *here*, so putting this page inside it would be a redirect loop. The
 * screen has no navigation, because there is nothing else to do until the
 * subscription is sorted out.
 */
export default async function ActivateLayout({ children }) {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  // Wrong area for this role — send them to their own home directly.
  if (actor.role !== ROLES.MILKMAN) redirect(ROLE_HOME[actor.role] ?? '/');

  return <div className="min-h-dvh bg-bg">{children}</div>;
}
