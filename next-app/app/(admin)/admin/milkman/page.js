import { requireAdmin } from '@/auth/session.js';
import * as adminService from '@/services/admin.service.js';
import * as onboardingService from '@/services/onboarding.service.js';

import Link from 'next/link';

import { PageHeader, Card, CardBody, EmptyState, Badge, Notice, Table, Th, Td } from '@/components/ui/index.jsx';
import { DeliveryIcon, PaymentsIcon } from '@/components/ui/Icons.jsx';
import { TabLinks, Button } from '@/components/ui/interactive.jsx';
import { MilkmanActions } from '@/components/admin/Milkman.jsx';

export const metadata = { title: 'Milkman' };

export default async function MilkmanPage({ searchParams }) {
  await requireAdmin();
  const params = await searchParams;

  /**
   * Accept both `?tab=` and `?verified=` — the dashboard links with the latter,
   * and a link that silently shows the wrong list is worse than no link.
   */
  const pendingApplications = await onboardingService.countPendingMilkmanApplications();

  const explicitTab =
    params?.tab ??
    (params?.verified === 'false' ? 'unverified' : params?.verified === 'true' ? 'verified' : null);

  // With applications waiting, that is what an administrator opened this page for.
  const tab = explicitTab ?? (pendingApplications > 0 ? 'unverified' : 'all');
  const verified = tab === 'verified' ? true : tab === 'unverified' ? false : undefined;

  const milkmanList = await adminService.listMilkman({ verified, limit: 200 });

  return (
    <>
      <PageHeader
        title="Milkman"
        description={
          pendingApplications > 0
            ? `${pendingApplications} application${pendingApplications === 1 ? '' : 's'} waiting`
            : `${milkmanList.length} shown`
        }
      />

      {pendingApplications > 0 && tab !== 'unverified' ? (
        <div className="mb-5">
          <Notice
            tone="caution"
            title={`${pendingApplications} business${pendingApplications === 1 ? '' : 'es'} waiting on you`}
            action={
              <Link href="/admin/milkman?tab=unverified">
                <Button size="sm">Review</Button>
              </Link>
            }
          >
            They cannot take a single customer until you verify them.
          </Notice>
        </div>
      ) : null}

      <TabLinks
        basePath="/admin/milkman"
        current={tab}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'verified', label: 'Verified' },
          { value: 'unverified', label: 'Applications', count: pendingApplications },
        ]}
      />

      {milkmanList.length === 0 ? (
        <EmptyState
          icon={<DeliveryIcon className="h-6 w-6 text-blue-600" />}
          title={tab === 'unverified' ? 'No applications waiting' : 'No milkman here'}
          description={
            tab === 'unverified'
              ? 'New applications appear here as soon as someone applies.'
              : undefined
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Business</Th>
                  <Th>Contact</Th>
                  <Th numeric>Customers</Th>
                  <Th>State</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {milkmanList.map((milkman) => (
                  <tr key={milkman.id}>
                    <Td>
                      <span className="font-medium">{milkman.businessName ?? '—'}</span>
                      <span className="block text-xs text-ink-muted">{milkman.name}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{milkman.email}</span>
                      {milkman.phone ? (
                        <a href={`tel:${milkman.phone}`} className="block text-xs text-brand">
                          {milkman.phone}
                        </a>
                      ) : null}
                    </Td>
                    <Td numeric>{milkman.customerCount}</Td>
                    <Td>
                      {milkman.isVerified ? (
                        <Badge tone="positive">Verified</Badge>
                      ) : milkman.suspendedAt ? (
                        <Badge tone="critical">Suspended</Badge>
                      ) : (
                        <Badge tone="caution">Awaiting</Badge>
                      )}
                    </Td>
                    <Td>
                      <MilkmanActions milkman={milkman} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </>
  );
}
