'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';

import { cn, Badge, StatusBadge } from '@/components/ui/index.jsx';
import { formatPaise } from '@/domain/money.js';
import { Button, Modal, Input, Textarea } from '@/components/ui/interactive.jsx';
import { EditIcon, PhoneIcon, MapPinIcon, CheckIcon, NoteIcon } from '@/components/ui/Icons.jsx';
import { approveCustomer, rejectCustomer, updateCustomerAddress } from '@/actions/milkman.actions.js';

/**
 * Modal to edit customer address & delivery instructions directly as a Milkman.
 * Features automated 6-digit PIN code location detection (City, State, Sector/Area).
 */
export function EditAddressModal({ customer, open, onClose }) {
  const [pending, startTransition] = useTransition();

  const [line1, setLine1] = useState(customer.addressLine1 ?? '');
  const [area, setArea] = useState(customer.addressArea ?? customer.deliveryArea ?? '');
  const [pincode, setPincode] = useState(customer.addressPincode ?? '');
  const [city, setCity] = useState(customer.addressCity ?? '');
  const [state, setState] = useState(customer.addressState ?? '');
  const [landmark, setLandmark] = useState(customer.addressLandmark ?? '');
  const [deliveryInstructions, setDeliveryInstructions] = useState(customer.deliveryInstructions ?? '');

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationResolved, setLocationResolved] = useState(false);
  const [areaSuggestions, setAreaSuggestions] = useState([]);

  // Auto-fetch City, State, and Area suggestions whenever a 6-digit pincode is entered
  useEffect(() => {
    const cleanPin = pincode.trim();
    if (cleanPin.length === 6 && /^\d{6}$/.test(cleanPin)) {
      let active = true;
      setIsFetchingLocation(true);

      fetch(`/api/pincode?pincode=${cleanPin}`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          setIsFetchingLocation(false);
          if (data?.ok) {
            if (data.city) setCity(data.city);
            if (data.state) setState(data.state);
            if (Array.isArray(data.areas) && data.areas.length > 0) {
              setAreaSuggestions(data.areas);
              if (!area) {
                setArea(data.areas[0]);
              }
            }
            setLocationResolved(true);
            toast.success(`Location detected: ${data.city}, ${data.state}`);
          } else {
            setLocationResolved(false);
          }
        })
        .catch(() => {
          if (active) {
            setIsFetchingLocation(false);
            setLocationResolved(false);
          }
        });

      return () => {
        active = false;
      };
    } else {
      setLocationResolved(false);
      setAreaSuggestions([]);
    }
  }, [pincode]);

  if (!open) return null;

  function onSubmit(event) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateCustomerAddress({
        customerId: customer.id,
        line1: line1.trim(),
        line2: undefined,
        area: area.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim(),
        landmark: landmark.trim() || undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
      });

      if (result.ok) {
        toast.success(`Updated address for ${customer.name}`);
        onClose();
      } else {
        toast.error(result.message ?? 'Could not update customer address.');
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Delivery Address · ${customer.name}`}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            form="edit-customer-address-form"
            type="submit"
            className="bg-brand hover:bg-brand/90 text-white font-bold"
            loading={pending}
          >
            Save Address Changes
          </Button>
        </div>
      }
    >
      <form id="edit-customer-address-form" onSubmit={onSubmit} className="space-y-3.5">
        <Input
          name="line1"
          label="House / Flat No. & Street"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="e.g. Flat 402, Tower B, Palm Heights"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Input
              name="area"
              label="Sector / Area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              list="customer-area-suggestions"
              placeholder="e.g. Sector 57"
              required
            />
            {areaSuggestions.length > 0 && (
              <datalist id="customer-area-suggestions">
                {areaSuggestions.map((sug, i) => (
                  <option key={i} value={sug} />
                ))}
              </datalist>
            )}
          </div>

          <div className="space-y-1">
            <Input
              name="pincode"
              label="Pincode"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="122003"
              required
            />
            {isFetchingLocation && (
              <p className="text-[11px] text-brand font-medium flex items-center gap-1 animate-pulse">
                <span className="inline-block h-2 w-2 rounded-full bg-brand animate-ping" />
                Detecting location...
              </p>
            )}
            {locationResolved && !isFetchingLocation && (
              <p className="text-[11px] text-positive font-semibold">
                Auto-detected: {city}, {state}
              </p>
            )}
          </div>
        </div>

        {/* Quick Area Suggestion Chips */}
        {areaSuggestions.length > 0 && (
          <div className="rounded-xl border border-brand/15 bg-brand-soft/50 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1.5">
              Available Local Sectors / Areas (Click to select)
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {areaSuggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setArea(sug)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                    area === sug
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : 'bg-white text-ink border-border hover:border-brand/40 hover:text-brand'
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            name="city"
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
          />
          <Input
            name="state"
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
          />
        </div>

        <Input
          name="landmark"
          label="Landmark (Optional)"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder="e.g. Near Mother Dairy booth"
        />

        <Textarea
          name="deliveryInstructions"
          label="Delivery Instructions (Optional)"
          value={deliveryInstructions}
          onChange={(e) => setDeliveryInstructions(e.target.value)}
          placeholder="e.g. Ring bell twice, leave bag on door handle"
          rows={2}
          maxLength={500}
        />
      </form>
    </Modal>
  );
}

/** A customer waiting for a decision. */
export function ApprovalCard({ customer, summary, atLimit }) {
  const [modal, setModal] = useState(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveCustomer({ customerId: customer.id });
      if (result.ok) {
        toast.success(`${customer.name} approved.`);
      } else if (result.code === 'CUSTOMER_LIMIT_REACHED') {
        toast.error(
          `You are at ${result.limit} customers on ${result.planName}. Upgrade to add more.`,
          { action: { label: 'Upgrade', onClick: () => (window.location.href = '/milkman/membership') } },
        );
      } else {
        toast.error(result.message ?? 'Could not approve.');
      }
    });
  }

  return (
    <>
      <article className="group relative overflow-hidden rounded-3xl border-2 border-amber-200 bg-white p-5 shadow-sm transition-all hover:border-amber-400 hover:shadow-md">
        {/* Top Amber line: wants decision */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-amber-500" />

        <div className="flex items-start gap-3.5">
          <Avatar name={customer.name} tone="caution" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-lg font-black tracking-tight text-slate-900">{customer.name}</h3>
              <StatusBadge status="PENDING" />
            </div>
            {summary?.productNames ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-700">
                <span className="font-medium opacity-70">Wants:</span>
                {summary.productNames}
              </p>
            ) : null}
            <p className="mt-1.5 flex items-start gap-1.5 text-xs sm:text-sm font-medium text-slate-600">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>
                {[customer.addressLine1, customer.addressArea, customer.addressPincode].filter(Boolean).join(', ') ||
                  'No address provided'}
                {customer.addressLandmark ? (
                  <span className="block text-xs font-semibold text-blue-600">Near {customer.addressLandmark}</span>
                ) : null}
              </span>
            </p>
            {customer.deliveryInstructions ? (
              <p className="mt-1.5 flex items-center gap-1.5 rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-900">
                <NoteIcon className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                <span>{customer.deliveryInstructions}</span>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setModal('editAddress')}
            aria-label="Edit delivery address"
            title="Edit delivery address"
            className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 shadow-xs transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            <EditIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline">
                <PhoneIcon className="h-3.5 w-3.5" />
                {customer.phone}
              </a>
            ) : null}
            <span className="truncate">{customer.email}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => setModal('reject')}
              className="tap flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 font-heading text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={atLimit || pending}
              onClick={approve}
              className="tap flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-5 font-heading text-xs font-black text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? null : <CheckIcon className="h-4 w-4 stroke-[2.5]" />}
              <span>{atLimit ? 'Limit Reached' : 'Approve & Start'}</span>
            </button>
          </div>
        </div>
      </article>

      {/* Edit Address Modal */}
      <EditAddressModal
        customer={customer}
        open={modal === 'editAddress'}
        onClose={() => setModal(null)}
      />

      {/* Decline Customer Modal */}
      <Modal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        title={`Decline ${customer.name}?`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button form="reject-form" type="submit" variant="danger" loading={pending}>
              Confirm Decline
            </Button>
          </div>
        }
      >
        <form
          id="reject-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get('reason');
            startTransition(async () => {
              const result = await rejectCustomer({ customerId: customer.id, reason });
              if (result.ok) {
                toast.success('Declined.');
                setModal(null);
              } else {
                toast.error(result.message ?? 'Could not decline.');
              }
            });
          }}
        >
          <p className="text-xs text-slate-500">The customer will receive this message explaining why you cannot accept them right now.</p>
          <Textarea
            name="reason"
            label="Reason for Declining"
            required
            maxLength={500}
            placeholder="e.g. Sorry, I do not deliver to your sector yet."
          />
        </form>
      </Modal>
    </>
  );
}

/** A row/card in the active customer book with instant address editing and direct call shortcut. */
export function CustomerRow({ customer, summary }) {
  const [editing, setEditing] = useState(false);
  const address =
    [customer.addressLine1, customer.addressArea, customer.addressPincode].filter(Boolean).join(', ');
  const monthlyPaise = Math.round(Number(summary?.totalMonthly ?? 0) * 100);

  return (
    <>
      <li className="px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5">
        <div className="flex items-start gap-3.5">
          <Avatar name={customer.name} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-base font-black tracking-tight text-slate-950">{customer.name}</h3>
              {customer.deliveryArea ? <Badge tone="brand">{customer.deliveryArea}</Badge> : null}
            </div>

            <p className="mt-1 flex items-start gap-1.5 text-xs sm:text-sm font-medium text-slate-600">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span className="min-w-0">
                {address || 'No address saved'}
                {customer.deliveryInstructions ? (
                  <span className="block text-xs font-semibold text-slate-500">“{customer.deliveryInstructions}”</span>
                ) : null}
              </span>
            </p>
          </div>

          {/* Action shortcuts */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit address for ${customer.name}`}
              title="Edit delivery address"
              className="tap flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:bg-blue-50 hover:text-blue-600 active:scale-95"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                aria-label={`Call ${customer.name}`}
                title={`Call ${customer.name}`}
                className="tap flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 shadow-xs transition-colors hover:bg-blue-600 hover:text-white active:scale-95"
              >
                <PhoneIcon className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Plan overview pill */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5 sm:ml-[3.5rem]">
          {summary?.count ? (
            <>
              <div className="min-w-0">
                <p className="truncate font-heading text-xs sm:text-sm font-bold text-slate-900">
                  {summary.count === 1 ? summary.productNames : `${summary.count} plans`}
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  {summary.count === 1 ? 'Daily active delivery' : summary.productNames}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-lg font-black leading-none text-blue-600">
                  {Number(summary.totalQuantity)}
                  <span className="font-sans text-xs font-bold text-slate-500 ml-0.5">L/day</span>
                </p>
                {monthlyPaise > 0 ? (
                  <p className="font-heading tnum mt-0.5 text-[11px] font-bold text-slate-400">
                    ~{formatPaise(monthlyPaise, { whole: true })}/mo
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-400">No active plan</p>
          )}
        </div>
      </li>

      {/* Edit Address Modal */}
      <EditAddressModal customer={customer} open={editing} onClose={() => setEditing(false)} />
    </>
  );
}

/** Initial in a tinted tile; blue for the book, amber while waiting. */
function Avatar({ name, tone = 'brand' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-heading text-base font-black shadow-xs',
        tone === 'caution'
          ? 'bg-amber-100 text-amber-800 border border-amber-200'
          : 'bg-blue-600 text-white shadow-md shadow-blue-500/20',
      )}
    >
      {(name ?? '?').charAt(0).toUpperCase()}
    </span>
  );
}
