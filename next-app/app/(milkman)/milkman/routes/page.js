import { requireMilkman } from '@/auth/session.js';
import * as usersRepo from '@/repositories/users.repo.js';
import { RoutesManager } from '@/components/milkman/RoutesClient.jsx';

export const metadata = { title: 'Delivery Routes & Areas • DairyDrop' };

export default async function MilkmanRoutesPage() {
  const actor = await requireMilkman();
  const areas = await usersRepo.listServiceAreas(actor.userId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <RoutesManager initialAreas={areas} />
    </div>
  );
}
