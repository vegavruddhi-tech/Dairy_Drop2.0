import { requireCustomer } from '@/auth/session.js';
import { businessMonth } from '@/domain/dates.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as billingService from '@/services/billing.service.js';
import { ProfileClient } from '@/components/customer/ProfileClient.jsx';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const actor = await requireCustomer();
  const month = businessMonth();

  const [customer, milkman, bill] = await Promise.all([
    usersRepo.findCustomer(actor, actor.userId),
    actor.tenantId ? usersRepo.findMilkmanPaymentInfo(actor.tenantId) : null,
    actor.tenantId ? billingService.getBill(actor, { month }).catch(() => null) : null,
  ]);

  return (
    <ProfileClient
      customer={customer}
      milkman={milkman}
      balancePaise={bill?.balancePaise ?? 0}
    />
  );
}
