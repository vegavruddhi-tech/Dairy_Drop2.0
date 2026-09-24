import { requireMilkman } from '@/auth/session.js';
import * as usersRepo from '@/repositories/users.repo.js';
import { RoutesManager } from '@/components/milkman/RoutesClient.jsx';

export const metadata = { title: 'Delivery routes' };

/**
 * The sectors and pincodes this milkman covers, in the order the round is
 * walked. Each one carries how many of the book live there, so a route that
 * has quietly gone empty is visible before it is deleted by mistake.
 */
export default async function MilkmanRoutesPage() {
  const actor = await requireMilkman();
  const [areas, customers] = await Promise.all([
    usersRepo.listServiceAreas(actor.userId),
    usersRepo.listCustomers(actor, { limit: 200 }),
  ]);

  // Customers per pincode. A plain object, since it crosses to a client component.
  const customerCounts = {};
  for (const customer of customers) {
    if (!customer.addressPincode) continue;
    customerCounts[customer.addressPincode] = (customerCounts[customer.addressPincode] ?? 0) + 1;
  }

  return <RoutesManager initialAreas={areas} customerCounts={customerCounts} />;
}
