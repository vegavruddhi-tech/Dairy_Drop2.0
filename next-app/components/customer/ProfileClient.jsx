'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, Field, PageHeader } from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { formatDate, businessDate } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import { EditProfileModal } from './EditProfileModal.jsx';
import { ChangeMilkmanModal } from './ChangeMilkmanModal.jsx';

export function ProfileClient({ customer, milkman, balancePaise = 0 }) {
  const [editOpen, setEditOpen] = useState(false);
  const [changeMilkmanOpen, setChangeMilkmanOpen] = useState(false);

  const addressString = [customer?.addressLine1, customer?.addressLine2].filter(Boolean).join(', ');
  const cityPincode = `${customer?.addressCity ?? ''} ${customer?.addressPincode ?? ''}`.trim();

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your account, delivery address, and dairy provider."
        action={
          <Button
            type="button"
            onClick={() => setEditOpen(true)}
            className="font-bold shadow-sm"
          >
            ✏️ Edit Profile & Address
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {/* ── Personal Info Card ──────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="You"
            action={
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Edit
              </button>
            }
          />
          <CardBody>
            <dl className="space-y-4">
              <Field label="Name" value={customer?.name} />
              <Field label="Email" value={customer?.email} />
              <Field label="Phone" value={customer?.phone} />
              <Field
                label="Customer since"
                value={customer?.createdAt ? formatDate(businessDate(customer.createdAt)) : '—'}
              />
            </dl>
          </CardBody>
        </Card>

        {/* ── Delivery Address Card ───────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Delivery address"
            action={
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Edit
              </button>
            }
          />
          <CardBody>
            <dl className="space-y-4">
              <Field label="Address" value={addressString || '—'} />
              <Field label="Area" value={customer?.addressArea || customer?.deliveryArea || '—'} />
              <Field label="City" value={cityPincode || '—'} />
              <Field label="Landmark" value={customer?.addressLandmark || '—'} />
              <Field label="Instructions" value={customer?.deliveryInstructions || '—'} />
            </dl>
          </CardBody>
        </Card>

        {/* ── Your Milkman Card ───────────────────────────────────────── */}
        <Card className="sm:col-span-2">
          <CardHeader
            title="Your milkman"
            description="Your designated daily dairy provider"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChangeMilkmanOpen(true)}
                className="font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                🔄 Change Milkman
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {balancePaise > 0 ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-black text-xs">
                    !
                  </span>
                  <div>
                    <p className="font-bold">Pending Dues: {formatPaise(balancePaise)}</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      You must clear pending dues with {milkman?.businessName || 'your milkman'} before switching providers.
                    </p>
                  </div>
                </div>
                <Link href="/billing">
                  <button
                    type="button"
                    className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
                  >
                    Pay Bill →
                  </button>
                </Link>
              </div>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Business" value={milkman?.businessName || '—'} />
              <Field label="Name" value={milkman?.name || '—'} />
              <Field
                label="Phone"
                value={
                  milkman?.phone ? (
                    <a href={`tel:${milkman.phone}`} className="text-brand font-semibold">
                      {milkman.phone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* Modals */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        customer={customer}
      />

      <ChangeMilkmanModal
        open={changeMilkmanOpen}
        onClose={() => setChangeMilkmanOpen(false)}
        currentMilkman={milkman}
        balancePaise={balancePaise}
        customerAddress={{
          pincode: customer?.addressPincode,
          area: customer?.addressArea || customer?.deliveryArea,
        }}
      />
    </>
  );
}
