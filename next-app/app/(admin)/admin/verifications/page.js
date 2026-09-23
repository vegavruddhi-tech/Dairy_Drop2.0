import { requireAdmin } from '@/auth/session.js';
import { formatInstant } from '@/domain/dates.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as adminService from '@/services/admin.service.js';

import { PageHeader, EmptyState, Notice } from '@/components/ui/index.jsx';
import { PaymentsIcon } from '@/components/ui/Icons.jsx';
import { VerificationCard } from '@/components/admin/Verifications.jsx';

export const metadata = { title: 'Verify payments' };

/**
 * The manual gate on all platform revenue.
 *
 * An operator checks each reference against the bank statement before a
 * milkman's panel opens. There is no automatic reconciliation — deliberately,
 * because UPI references are not reliably machine-matchable.
 */
export default async function VerificationsPage() {
  await requireAdmin();
  const pending = await adminService.listVerifications();

  return (
    <>
      <PageHeader
        title="Verify payments"
        description={`${pending.length} waiting`}
      />

      <div className="mb-5">
        <Notice tone="caution" title="Check the bank statement first">
          Approving opens the milkman's panel for a full billing period. Match the
          reference against money actually received before you approve.
        </Notice>
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={<PaymentsIcon className="h-6 w-6 text-blue-600" />} title="Nothing to verify" description="Submitted payments appear here." />
      ) : (
        <div className="space-y-3">
          {pending.map((item) => (
            <VerificationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
