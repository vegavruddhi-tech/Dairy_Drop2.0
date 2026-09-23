'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge, StatusBadge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Textarea } from '@/components/ui/interactive.jsx';
import { EditIcon } from '@/components/ui/Icons.jsx';
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
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
              <p className="text-[11px] text-blue-600 font-medium flex items-center gap-1 animate-pulse">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                Detecting location...
              </p>
            )}
            {locationResolved && !isFetchingLocation && (
              <p className="text-[11px] text-emerald-600 font-semibold">
                Auto-detected: {city}, {state}
              </p>
            )}
          </div>
        </div>

        {/* Quick Area Suggestion Chips */}
        {areaSuggestions.length > 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
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
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-700'
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
export function ApprovalCard({ customer, atLimit }) {
  const [modal, setModal] = useState(null); // 'reject' | 'editAddress' | null
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
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3.5 hover:border-blue-200 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base font-extrabold text-slate-900">{customer.name}</h3>
              <StatusBadge status="PENDING" />
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed font-medium">
              {[customer.addressLine1, customer.addressArea, customer.addressPincode]
                .filter(Boolean)
                .join(', ') || 'No address provided'}
            </p>
            {customer.addressLandmark ? (
              <p className="text-[11px] font-semibold text-blue-600 mt-0.5">
                Near {customer.addressLandmark}
              </p>
            ) : null}
            {customer.deliveryInstructions ? (
              <p className="text-[11px] text-slate-500 italic mt-0.5">
                Note: "{customer.deliveryInstructions}"
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setModal('editAddress')}
            className="tap inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all shrink-0"
          >
            <EditIcon className="h-3.5 w-3.5" />
            <span>Edit Address</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center gap-3 text-slate-600">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="font-bold text-blue-600 hover:underline flex items-center gap-1">
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                {customer.phone}
              </a>
            ) : null}
            <span className="text-slate-400">·</span>
            <span className="truncate max-w-[180px]">{customer.email}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModal('reject')} className="text-xs text-red-600 hover:bg-red-50">
              Decline
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
              loading={pending}
              disabled={atLimit}
              onClick={approve}
            >
              {atLimit ? 'Limit reached' : 'Approve Customer'}
            </Button>
          </div>
        </div>
      </div>

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
          <p className="text-xs text-slate-600">The customer will receive this message explaining why you cannot accept them right now.</p>
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

  return (
    <>
      <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-heading text-sm font-extrabold text-slate-900">{customer.name}</p>
            {customer.deliveryArea && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                {customer.deliveryArea}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-slate-600 truncate">
            {[customer.addressLine1, customer.addressArea, customer.addressPincode]
              .filter(Boolean)
              .join(', ') || 'No address saved'}
          </p>

          {customer.deliveryInstructions && (
            <p className="text-[11px] text-slate-500 italic mt-0.5">
              "{customer.deliveryInstructions}"
            </p>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {/* Plan Summary */}
          <div className="text-left sm:text-right">
            {summary?.count ? (
              <>
                <p className="text-xs font-bold text-slate-900">
                  {summary.count === 1 ? summary.productNames : `${summary.count} plans`}
                </p>
                <p className="text-[11px] font-semibold text-blue-600">
                  {Number(summary.totalQuantity)} L/day
                </p>
              </>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">No active plan</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Edit Address Button */}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="tap inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-2xs transition-all"
              title="Edit Delivery Address"
            >
              <EditIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Address</span>
            </button>

            {/* Phone Call Link */}
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="tap inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 shadow-2xs transition-all"
                title={`Call ${customer.name}`}
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                <span>Call</span>
              </a>
            ) : null}
          </div>
        </div>
      </li>

      {/* Edit Address Modal */}
      <EditAddressModal
        customer={customer}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </>
  );
}
