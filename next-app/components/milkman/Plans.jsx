'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveMilkPlan, retireMilkPlan } from '@/actions/milkman.actions.js';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import { businessMonth } from '@/domain/dates.js';
import { resolveUnitPrice, quotedMonthlyPaise, countDeliveries } from '@/domain/pricing.js';

const UNITS = [
  { value: 'L', label: 'Litres' },
  { value: 'ml', label: 'Millilitres' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'pcs', label: 'Pieces' },
];

const FREQUENCIES = [
  { value: 'DAILY', label: 'Every day' },
  { value: 'ALTERNATE_DAYS', label: 'Alternate days' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

/** What one of this unit is called, for "a price per litre". */
const UNIT_NOUN = { L: 'litre', ml: 'millilitre', kg: 'kilogram', g: 'gram', pcs: 'piece' };

const PRICE_LABEL = {
  MONTHLY: () => 'Monthly price (₹)',
  PER_UNIT: (unit) => `Price per ${UNIT_NOUN[unit] ?? 'unit'} (₹)`,
  PER_DELIVERY: () => 'Price per delivery (₹)',
};

const PRICE_HINT = {
  MONTHLY:
    'Spread across every delivery in the month. Customers pay only for what is actually delivered.',
  PER_UNIT: 'The monthly figure is worked out from this.',
  PER_DELIVERY: 'Charged for each delivery that actually happens.',
};

const SLOTS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'BOTH', label: 'Morning & evening' },
];

import { MILK_TYPES, QUANTITY_PRESETS, generatePlanDefaults } from '@/domain/planPresets.js';

export function PlanEditor({ plan, trigger }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});
  const [selectedMilkType, setSelectedMilkType] = useState('cow_milk');
  const [selectedQtyPreset, setSelectedQtyPreset] = useState('1');

  const [basis, setBasis] = useState(plan?.monthlyPrice ? 'MONTHLY' : 'PER_DELIVERY');
  const [slot, setSlot] = useState(plan?.slot ?? 'MORNING');
  const [frequency, setFrequency] = useState(plan?.frequency ?? 'DAILY');
  const [name, setName] = useState(plan?.name ?? '1L Pure Cow Milk Daily');
  const [productName, setProductName] = useState(plan?.productName ?? 'Pure Cow Milk');
  const [quantity, setQuantity] = useState(
    plan?.quantity ? String(Number(plan.quantity)) : '1',
  );
  const [price, setPrice] = useState(
    plan ? String(Number(plan.monthlyPrice ?? plan.pricePerDelivery)) : '64.00',
  );
  const [unit, setUnit] = useState(plan?.unit ?? 'L');
  const [description, setDescription] = useState(
    plan?.description ?? 'Fresh, 100% pure cow milk directly from local dairy farms.',
  );

  const showMorning = slot === 'MORNING' || slot === 'BOTH';
  const showEvening = slot === 'EVENING' || slot === 'BOTH';

  function applyPreset(milkTypeId, qtyVal, freq = frequency) {
    const defaults = generatePlanDefaults(milkTypeId, qtyVal, freq);
    setName(defaults.name);
    setProductName(defaults.productName);
    setQuantity(defaults.quantity);
    setUnit(defaults.unit);
    setDescription(defaults.description);
    setPrice(basis === 'MONTHLY' ? defaults.monthlyPrice : defaults.pricePerDelivery);
  }

  function handleMilkTypeChange(val) {
    setSelectedMilkType(val);
    applyPreset(val, quantity);
  }

  function handleQtyPresetChange(val) {
    setSelectedQtyPreset(val);
    if (val !== 'custom') {
      applyPreset(selectedMilkType, val);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>{plan ? 'Edit' : 'New plan'}</Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={plan ? 'Edit Milk Plan' : 'Create New Milk Plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="plan-form" type="submit" loading={pending} className="bg-blue-600 hover:bg-blue-700 font-bold">Save Plan</Button>
          </>
        }
      >
        <form
          id="plan-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            startTransition(async () => {
              const result = await saveMilkPlan({
                ...data,
                id: plan?.id,
                isActive: true,
              });
              if (result.ok) {
                toast.success('Plan saved.');
                setOpen(false);
                setErrors({});
              } else {
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save that plan.');
              }
            });
          }}
        >
          {/* Quick Predefined Dropdown Selector */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                ⚡ Quick Presets (Auto-fills name, price & info)
              </span>
              <span className="text-[10px] font-medium text-slate-500">Market Rate Standard</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Milk Type</label>
                <select
                  value={selectedMilkType}
                  onChange={(e) => handleMilkTypeChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  {MILK_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (₹{m.defaultPricePerLitre}/L)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Daily Quantity</label>
                <select
                  value={selectedQtyPreset}
                  onChange={(e) => handleQtyPresetChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  {QUANTITY_PRESETS.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Input
            name="name"
            label="Plan name (Visible to Customer)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            placeholder="1L Pure Cow Milk Daily"
          />

          <Input
            name="productName"
            label="What is delivered"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            error={errors.productName}
            required
            placeholder="Pure Cow Milk"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              name="quantity"
              label="Quantity per delivery"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                applyPreset(selectedMilkType, event.target.value);
              }}
              error={errors.quantity}
              required
            />
            <Select
              name="unit"
              label="Unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              options={UNITS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              name="frequency"
              label="How often"
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value);
                applyPreset(selectedMilkType, quantity, event.target.value);
              }}
              options={FREQUENCIES}
            />
            <Select
              name="slot"
              label="When"
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              options={SLOTS}
            />
          </div>

          <Textarea
            name="description"
            label="Plan Description (Auto-generated or custom)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />

          {/*
            The delivery window, for each slot the plan actually runs.

            A window rather than a single time: one bike covers the whole area,
            so a fixed "06:00" would be a promise broken at every door but the
            first. Only the slots in use are asked for, and switching away from
            a slot clears its times server-side rather than leaving them stale.
          */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/50 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
              When do you reach the door?
            </p>

              {showMorning ? (
                <div>
                  <p className="mb-1.5 text-sm font-bold text-ink">Morning</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="time"
                      name="morningStart"
                      label="From"
                      defaultValue={toTimeValue(plan?.morningStart) || '06:00'}
                      error={errors.morningStart}
                    />
                    <Input
                      type="time"
                      name="morningEnd"
                      label="To"
                      defaultValue={toTimeValue(plan?.morningEnd) || '07:30'}
                      error={errors.morningEnd}
                    />
                  </div>
                </div>
              ) : null}

              {showEvening ? (
                <div>
                  <p className="mb-1.5 text-sm font-bold text-ink">Evening</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="time"
                      name="eveningStart"
                      label="From"
                      defaultValue={toTimeValue(plan?.eveningStart) || '17:30'}
                      error={errors.eveningStart}
                    />
                    <Input
                      type="time"
                      name="eveningEnd"
                      label="To"
                      defaultValue={toTimeValue(plan?.eveningEnd) || '19:00'}
                      error={errors.eveningEnd}
                    />
                  </div>
                </div>
              ) : null}

            <p className="text-xs text-ink-muted">
              Your customers see this on their plan, so give yourself a range you can keep.
            </p>
          </div>

          {/*
            Exactly one pricing basis — the database enforces the same rule.
            Allowing both is what made the old bills impossible to explain.
          */}
          <Select
            name="pricingBasis"
            label="How do you price it?"
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
            options={[
              { value: 'MONTHLY', label: 'A monthly price' },
              { value: 'PER_UNIT', label: `A price per ${UNIT_NOUN[unit] ?? 'unit'}` },
              { value: 'PER_DELIVERY', label: 'A price per delivery' },
            ]}
          />

          <Input
            name="price"
            label={PRICE_LABEL[basis](unit)}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={errors.price}
            required
            hint={PRICE_HINT[basis]}
          />

          {/*
            What this actually comes to, worked out with the same functions the
            server uses — so the number quoted here is the number billed, rather
            than a second implementation that can drift.
          */}
          <PriceEstimate
            basis={basis}
            price={price}
            quantity={quantity}
            unit={unit}
            slot={slot}
            frequency={frequency}
          />

          <Textarea name="description" label="Description (optional)" defaultValue={plan?.description ?? ''} maxLength={500} />
        </form>
      </Modal>
    </>
  );
}

export function PlanList({ plans, subscriberCounts = {} }) {
  const [pending, startTransition] = useTransition();
  const [retiringId, setRetiringId] = useState(null);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const subscribers = subscriberCounts[plan.id] ?? 0;
        return (
          <Card
            key={plan.id}
            className={`border border-slate-200 bg-white shadow-sm hover:border-blue-400 hover:shadow-md transition-all rounded-3xl overflow-hidden flex flex-col ${
              plan.isActive ? '' : 'opacity-60'
            }`}
          >
            <CardBody className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 uppercase">
                    {plan.productName}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-slate-950 mt-1.5">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{plan.description}</p>
                  )}
                </div>
                {plan.isActive ? (
                  subscribers > 0 ? (
                    <Badge tone="positive">
                      {subscribers} {subscribers === 1 ? 'Customer' : 'Customers'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">0 Active</Badge>
                  )
                ) : (
                  <Badge tone="neutral">Retired</Badge>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 pt-2 border-t border-slate-100">
                <span className="font-heading text-2xl font-black text-slate-900">
                  {plan.quotedMonthlyPaise != null
                    ? formatPaise(plan.quotedMonthlyPaise, { whole: true })
                    : '—'}
                </span>
                <span className="text-xs font-semibold text-slate-500">/ month est.</span>
              </div>

              <ul className="space-y-1 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                <li className="flex justify-between">
                  <span>Per Delivery:</span>
                  <span className="font-bold text-slate-900">{Number(plan.quantity)} {plan.unit}</span>
                </li>
                <li className="flex justify-between">
                  <span>Frequency & Slot:</span>
                  <span className="font-semibold text-slate-800">
                    {plan.frequency.replace('_', ' ').toLowerCase()} · {plan.slot.toLowerCase()}
                  </span>
                </li>
                {plan.unitPrice ? (
                  <li className="flex justify-between">
                    <span>Rate:</span>
                    <span className="font-bold text-blue-700">₹{Number(plan.unitPrice).toFixed(2)}/{plan.unit}</span>
                  </li>
                ) : null}
              </ul>

              <div className="mt-auto flex items-center gap-2 pt-2">
                <PlanEditor
                  plan={plan}
                  trigger={<Button size="sm" variant="outline" className="flex-1 font-bold">Edit Plan</Button>}
                />
                {plan.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={retiringId === plan.id}
                    disabled={pending && retiringId !== plan.id}
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => {
                      const on = subscriberCounts[plan.id] ?? 0;
                      const warning =
                        on > 0
                          ? `${on} customer${on === 1 ? 'is' : 'are'} on "${plan.name}". ` +
                            `Retiring it stops their deliveries from today. Already delivered days stay billed.\n\nRetire it anyway?`
                          : `Retire "${plan.name}"? Nobody is on it, so nothing stops.`;
                      if (!window.confirm(warning)) return;

                      setRetiringId(plan.id);
                      startTransition(async () => {
                        try {
                          const result = await retireMilkPlan({ id: plan.id });
                          if (result.ok) {
                            const ended = result.data?.ended ?? 0;
                            toast.success(
                              ended > 0
                                ? `Plan retired. ${ended} subscription${ended === 1 ? '' : 's'} ended.`
                                : 'Plan retired.',
                            );
                          } else {
                            toast.error(result.message ?? 'Could not retire that plan.');
                          }
                        } finally {
                          setRetiringId(null);
                        }
                      });
                    }}
                  >
                    Retire
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/** Postgres `time` comes back as 'HH:MM:SS'; a time input wants 'HH:MM'. */
function toTimeValue(value) {
  return typeof value === 'string' ? value.slice(0, 5) : '';
}

/**
 * The delivery windows on a plan card, one line per slot it runs.
 *
 * Silent when the plan predates windows — an unset time is not "midnight".
 */
function PlanWindows({ plan }) {
  const morning = formatWindow(plan.morningStart, plan.morningEnd);
  const evening = formatWindow(plan.eveningStart, plan.eveningEnd);
  if (!morning && !evening) return null;

  return (
    <>
      {morning ? <li className="text-ink">Morning {morning}</li> : null}
      {evening ? <li className="text-ink">Evening {evening}</li> : null}
    </>
  );
}

/**
 * A live read-out of what the plan costs.
 *
 * Built from the real pricing functions rather than a second sum written for
 * the form: `resolveUnitPrice` and `quotedMonthlyPaise` are pure and have no
 * database in them, so the preview cannot drift from the bill.
 *
 * Silent while the inputs are incomplete — a half-typed price should not flash
 * a number at someone about to set what their customers pay.
 */
function PriceEstimate({ basis, price, quantity, unit, slot, frequency }) {
  const month = businessMonth();

  const draft = {
    quantity,
    slot,
    frequency,
    monthlyPrice: basis === 'MONTHLY' ? price : null,
    pricePerDelivery:
      basis === 'PER_DELIVERY'
        ? price
        : basis === 'PER_UNIT'
          ? String((Number(price) || 0) * (Number(quantity) || 0))
          : null,
  };

  let rate;
  try {
    if (!(Number(price) > 0) || !(Number(quantity) > 0)) return null;
    rate = resolveUnitPrice(draft, month);
  } catch {
    return null;
  }

  const drops = countDeliveries(draft, month);
  const monthly = quotedMonthlyPaise(draft, month);
  const perDay = slot === 'BOTH' ? 2 : 1;

  return (
    <div className="rounded-2xl border border-border bg-surface-muted/50 p-3.5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
        What this comes to
      </p>
      <dl className="space-y-1.5 text-sm">
        <Line label={`Per ${UNIT_NOUN[unit] ?? 'unit'}`} value={`₹${Number(rate.unitPrice).toFixed(2)}`} />
        <Line
          label={`Per delivery (${Number(quantity)} ${unit})`}
          value={formatPaise(rate.perDeliveryPaise)}
        />
        <Line
          label={`Deliveries this month (${perDay} a day)`}
          value={String(drops)}
        />
        <div className="flex items-center justify-between border-t border-border pt-1.5">
          <dt className="font-medium text-ink">A full month</dt>
          <dd className="tnum font-semibold text-ink">{formatPaise(monthly, { whole: true })}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-muted">
        An estimate for {month}. Customers are billed only for deliveries that happen.
      </p>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tnum text-ink">{value}</dd>
    </div>
  );
}
