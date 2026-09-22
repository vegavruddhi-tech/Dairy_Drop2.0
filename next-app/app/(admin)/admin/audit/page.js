import { requireAdmin } from '@/auth/session.js';
import * as adminService from '@/services/admin.service.js';

import { PageHeader, Card, CardBody, Table, Th, Td, Badge, EmptyState } from '@/components/ui/index.jsx';

export const metadata = { title: 'Audit log' };

/**
 * Append-only record of every privileged action.
 *
 * The previous admin console had no equivalent, so there was no way to answer
 * "who suspended this milkman, and when".
 */
export default async function AuditPage() {
  await requireAdmin();
  const entries = await adminService.listAuditLog({ limit: 200 });

  return (
    <>
      <PageHeader title="Audit log" description="Every privileged action, newest first." />

      {entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="whitespace-nowrap text-xs text-ink-muted">
                      {new Date(entry.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Td>
                    <Td className="text-sm">{entry.actorEmail ?? '—'}</Td>
                    <Td>
                      <Badge tone={entry.action.includes('REJECT') || entry.action.includes('SUSPEND') ? 'critical' : 'neutral'}>
                        {entry.action.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className="max-w-xs truncate text-xs text-ink-muted">
                      {entry.metadata && Object.keys(entry.metadata).length > 0
                        ? JSON.stringify(entry.metadata)
                        : entry.subjectType ?? '—'}
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
