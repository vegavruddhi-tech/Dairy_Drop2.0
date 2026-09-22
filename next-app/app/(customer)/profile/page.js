import { requireCustomer } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import * as usersRepo from '@/repositories/users.repo.js';

import { PageHeader, Card, CardBody, CardHeader, Field, Divider } from '@/components/ui/index.jsx';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const actor = await requireCustomer();

  const [customer, milkman] = await Promise.all([
    usersRepo.findCustomer(actor, actor.userId),
    usersRepo.findMilkmanPaymentInfo(actor.tenantId),
  ]);

  return (
    <>
      <PageHeader title="Profile" />

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader title="You" />
          <CardBody>
            <dl className="space-y-4">
              <Field label="Name" value={customer?.name} />
              <Field label="Email" value={customer?.email} />
              <Field label="Phone" value={customer?.phone} />
              <Field label="Customer since" value={customer?.createdAt ? formatDate(String(customer.createdAt).slice(0, 10)) : '—'} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Delivery address" />
          <CardBody>
            <dl className="space-y-4">
              <Field label="Address" value={[customer?.addressLine1, customer?.addressLine2].filter(Boolean).join(', ')} />
              <Field label="Area" value={customer?.addressArea} />
              <Field label="City" value={`${customer?.addressCity ?? ''} ${customer?.addressPincode ?? ''}`.trim()} />
              <Field label="Landmark" value={customer?.addressLandmark} />
              <Field label="Instructions" value={customer?.deliveryInstructions} />
            </dl>
          </CardBody>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader title="Your milkman" />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Business" value={milkman?.businessName} />
              <Field label="Name" value={milkman?.name} />
              <Field
                label="Phone"
                value={milkman?.phone ? <a href={`tel:${milkman.phone}`} className="text-brand">{milkman.phone}</a> : '—'}
              />
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
