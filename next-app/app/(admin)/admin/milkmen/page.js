import { requireAdmin } from '@/auth/session.js';
import * as adminService from '@/services/admin.service.js';
import * as onboardingService from '@/services/onboarding.service.js';

import Link from 'next/link';

import { PageHeader, Card, CardBody, EmptyState, Badge, Notice, Table, Th, Td } from '@/components/ui/index.jsx';
import { DeliveryIcon, PaymentsIcon } from '@/components/ui/Icons.jsx';
import { TabLinks, Button } from '@/components/ui/interactive.jsx';
import { MilkmanActions } from '@/components/admin/Milkmen.jsx';

export const metadata = { title: 'Milkmen' };

export default async function MilkmenPage({ searchParams }) {
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

  const milkmen = await adminService.listMilkmen({ verified, limit: 200 });

  return (
    <>
      <PageHeader
        title="Milkmen"
        description={
          pendingApplications > 0
            ? `${pendingApplications} application${pendingApplications === 1 ? '' : 's'} waiting`
            : `${milkmen.length} shown`
        }
      />

      {pendingApplications > 0 && tab !== 'unverified' ? (
        <div className="mb-5">
          <Notice
            tone="caution"
            title={`${pendingApplications} business${pendingApplications === 1 ? '' : 'es'} waiting on you`}
            action={
              <Link href="/admin/milkmen?tab=unverified">
                <Button size="sm">Review</Button>
              </Link>
            }
          >
            They cannot take a single customer until you verify them.
          </Notice>
        </div>
      ) : null}

      <TabLinks
        basePath="/admin/milkmen"
        current={tab}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'verified', label: 'Verified' },
          { value: 'unverified', label: 'Applications', count: pendingApplications },
        ]}
      />

      {milkmen.length === 0 ? (
        <EmptyState
          icon={<DeliveryIcon className="h-6 w-6 text-blue-600" />}
          title={tab === 'unverified' ? 'No applications waiting' : 'No milkmen here'}
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
                {milkmen.map((milkman) => (
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
