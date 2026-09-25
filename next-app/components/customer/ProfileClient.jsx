'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, Field, PageHeader } from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { formatDate, businessDate } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import { EditProfileModal } from './EditProfileModal.jsx';
import { ChangeMilkmanModal } from './ChangeMilkmanModal.jsx';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { useT } from '@/i18n/provider.jsx';

export function ProfileClient({ customer, milkman, balancePaise = 0 }) {
  const [editOpen, setEditOpen] = useState(false);
  const [changeMilkmanOpen, setChangeMilkmanOpen] = useState(false);
  const { locale } = useT();
  const isHi = locale === 'hi';

  const addressString = [customer?.addressLine1, customer?.addressLine2].filter(Boolean).join(', ');
  const cityPincode = `${customer?.addressCity ?? ''} ${customer?.addressPincode ?? ''}`.trim();

  return (
    <>
      <PageHeader
        title={isHi ? 'प्रोफ़ाइल' : 'Profile'}
        description={isHi ? 'अपना खाता, डिलीवरी पता और डेयरी विक्रेता प्रबंधित करें।' : 'Manage your account, delivery address, and dairy provider.'}
        action={
          <Button
            type="button"
            onClick={() => setEditOpen(true)}
            className="font-bold shadow-sm"
          >
            {isHi ? '✏️ प्रोफ़ाइल व पता बदलें' : '✏️ Edit Profile & Address'}
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {/* ── Personal Info Card ──────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={isHi ? 'आपकी जानकारी' : 'You'}
            action={
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {isHi ? 'बदलें' : 'Edit'}
              </button>
            }
          />
          <CardBody>
            <dl className="space-y-4">
              <Field label={isHi ? 'नाम' : 'Name'} value={customer?.name} />
              <Field label={isHi ? 'ईमेल' : 'Email'} value={customer?.email} />
              <Field label={isHi ? 'फ़ोन नंबर' : 'Phone'} value={customer?.phone} />
              <Field
                label={isHi ? 'सदस्य बने' : 'Customer since'}
                value={customer?.createdAt ? formatDate(businessDate(customer.createdAt)) : '—'}
              />
            </dl>
          </CardBody>
        </Card>

        {/* ── Delivery Address Card ───────────────────────────────────── */}
        <Card>
          <CardHeader
            title={isHi ? 'डिलीवरी का पता' : 'Delivery address'}
            action={
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {isHi ? 'बदलें' : 'Edit'}
              </button>
            }
          />
          <CardBody>
            <dl className="space-y-4">
              <Field label={isHi ? 'मकान / पता' : 'Address'} value={addressString || '—'} />
              <Field label={isHi ? 'क्षेत्र / सेक्टर' : 'Area'} value={customer?.addressArea || customer?.deliveryArea || '—'} />
              <Field label={isHi ? 'शहर / पिनकोड' : 'City'} value={cityPincode || '—'} />
              <Field label={isHi ? 'लैंडमार्क' : 'Landmark'} value={customer?.addressLandmark || '—'} />
              <Field label={isHi ? 'निर्देश' : 'Instructions'} value={customer?.deliveryInstructions || '—'} />
            </dl>
          </CardBody>
        </Card>

        {/* ── Your Milkman Card ───────────────────────────────────────── */}
        <Card className="sm:col-span-2">
          <CardHeader
            title={isHi ? 'आपका दूध विक्रेता' : 'Your milkman'}
            description={isHi ? 'आपका दैनिक दूध सेवा प्रदाता' : 'Your designated daily dairy provider'}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChangeMilkmanOpen(true)}
                className="font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {isHi ? '🔄 दूधवाला बदलें' : '🔄 Change Milkman'}
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
                    <p className="font-bold">{isHi ? 'बकाया देय राशि' : 'Pending Dues'}: {formatPaise(balancePaise)}</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      {isHi
                        ? `दूध विक्रेता बदलने से पहले आपको ${milkman?.businessName || 'अपने दूधवाले'} का बकाया बिल चुकाना होगा।`
                        : `You must clear pending dues with ${milkman?.businessName || 'your milkman'} before switching providers.`}
                    </p>
                  </div>
                </div>
                <Link href="/billing">
                  <button
                    type="button"
                    className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
                  >
                    {isHi ? 'बिल भरें →' : 'Pay Bill →'}
                  </button>
                </Link>
              </div>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={isHi ? 'डेयरी नाम' : 'Business'} value={milkman?.businessName || '—'} />
              <Field label={isHi ? 'विक्रेता नाम' : 'Name'} value={milkman?.name || '—'} />
              <Field
                label={isHi ? 'फ़ोन नंबर' : 'Phone'}
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

        {/* ── Language Preferences Card ─────────────────────────────────── */}
        <Card className="sm:col-span-2">
          <CardHeader
            title="Language / भाषा"
            description={isHi ? 'अपनी पसंदीदा प्रदर्शन भाषा चुनें' : 'Choose your preferred display language'}
          />
          <CardBody>
            <div className="max-w-xs">
              <LanguageToggle />
            </div>
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
