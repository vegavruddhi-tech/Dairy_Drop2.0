'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { cn, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveMilkPlan, retireMilkPlan, deleteMilkPlan } from '@/actions/milkman.actions.js';
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SunIcon,
  MoonIcon,
  ClockIcon,
  UsersIcon,
  MilkDropIcon,
  CalendarIcon,
  SparklesIcon,
} from '@/components/ui/Icons.jsx';
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
  const router = useRouter();
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
            <Button
              form="plan-form"
              type="submit"
              loading={pending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-heading font-bold shadow-md shadow-blue-500/20 px-5 py-2.5 rounded-xl transition-all"
            >
              Save Plan
            </Button>
          </>
        }
      >
        <form
          id="plan-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setOpen(false);
            const toastId = toast.loading(plan?.id ? 'Updating plan…' : 'Creating plan…');
            startTransition(async () => {
              const result = await saveMilkPlan({
                ...data,
                id: plan?.id,
                isActive: true,
              });
              if (result.ok) {
                toast.success('Plan saved successfully!', { id: toastId });
                setErrors({});
              } else {
                setOpen(true);
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save that plan.', { id: toastId });
              }
            });
          }}
        >
          {/* Quick Predefined Dropdown Selector */}
          <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
                <SparklesIcon className="h-3.5 w-3.5 text-brand" />
                <span>Quick Presets (Auto-fills name, price & info)</span>
              </span>
              <span className="text-[10px] font-medium text-ink-subtle">Market Rate Standard</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Select Milk Type</label>
                <select
                  value={selectedMilkType}
                  onChange={(e) => handleMilkTypeChange(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm focus:border-brand focus:outline-none"
                >
                  {MILK_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (₹{m.defaultPricePerLitre}/L)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Select Daily Quantity</label>
                <select
                  value={selectedQtyPreset}
                  onChange={(e) => handleQtyPresetChange(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm focus:border-brand focus:outline-none"
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
              { value: 'PER_UNIT', label: `A price per ${UNIT_NOUN[unit] ?? 'unit'}` }
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

const SLOT_META = {
  MORNING: { label: 'Morning', Icon: SunIcon },
  EVENING: { label: 'Evening', Icon: MoonIcon },
  BOTH: { label: 'Morning & evening', Icon: SunIcon },
};

const FREQUENCY_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label]));

/**
 * The plan cards, with retire and delete behind confirm sheets.
 *
 * Both end whoever is still on the plan, so the sheet says how many that is
 * before the button is pressed — that number is the whole decision.
 */
export function PlanList({ plans, subscriberCounts = {} }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(null); // { kind: 'retire' | 'delete', plan }

  function run() {
    const { kind, plan } = confirm;
    startTransition(async () => {
      const result = kind === 'delete' ? await deleteMilkPlan({ id: plan.id }) : await retireMilkPlan({ id: plan.id });
      if (result.ok) {
        const ended = result.data?.ended ?? 0;
        const verb = kind === 'delete' ? 'deleted' : 'retired';
        toast.success(
          ended > 0
            ? `Plan ${verb}. ${ended} subscription${ended === 1 ? '' : 's'} ended.`
            : `Plan ${verb}.`,
        );
        setConfirm(null);
      } else {
        toast.error(result.message ?? `Could not ${kind} that plan.`);
      }
    });
  }

  const on = confirm ? subscriberCounts[confirm.plan.id] ?? 0 : 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            subscribers={subscriberCounts[plan.id] ?? 0}
            onRetire={() => setConfirm({ kind: 'retire', plan })}
            onDelete={() => setConfirm({ kind: 'delete', plan })}
          />
        ))}
      </div>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `${confirm.kind === 'delete' ? 'Delete' : 'Retire'} ${confirm.plan.name}?` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Keep it</Button>
            <Button variant="danger" loading={pending} onClick={run}>
              {confirm?.kind === 'delete' ? <TrashIcon className="h-4 w-4" /> : null}
              {confirm?.kind === 'delete' ? 'Delete plan' : 'Retire plan'}
            </Button>
          </>
        }
      >
        {confirm ? (
          <div className="space-y-3 text-sm text-ink-muted">
            {on > 0 ? (
              <p className="rounded-xl border border-caution/25 bg-caution-soft px-3 py-2 text-xs font-semibold text-caution">
                {on} {on === 1 ? 'customer is' : 'customers are'} on this plan. Their deliveries stop from
                today and they are told to pick another plan. Days already delivered stay billed.
              </p>
            ) : (
              <p>Nobody is on it, so no deliveries change.</p>
            )}
            {confirm.kind === 'delete' ? (
              <p>
                The plan is removed for good, along with any pending requests to switch onto it.
                Past bills are unaffected — they keep the prices that were charged.
              </p>
            ) : (
              <p>
                It leaves the shop but stays on record under “Retired”. Choose Delete if you want it gone.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/** One plan. */
function PlanCard({ plan, subscribers, onRetire, onDelete }) {
  const slot = SLOT_META[plan.slot] ?? SLOT_META.MORNING;
  const morning = formatWindow(plan.morningStart, plan.morningEnd);
  const evening = formatWindow(plan.eveningStart, plan.eveningEnd);
  const windows = [
    plan.slot !== 'EVENING' && morning ? { label: 'Morning', value: morning, Icon: SunIcon } : null,
    plan.slot !== 'MORNING' && evening ? { label: 'Evening', value: evening, Icon: MoonIcon } : null,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        'card-surface relative flex flex-col overflow-hidden transition-shadow hover:shadow-card-hover',
        plan.isActive ? '' : 'opacity-75',
      )}
    >
      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', plan.isActive ? 'bg-hero-gradient' : 'bg-border')} />

      {/* ── Head ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', plan.isActive ? 'bg-brand-soft text-brand' : 'bg-surface-muted text-ink-subtle')}>
          <MilkDropIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">{plan.productName}</p>
          <h3 className="font-heading text-base font-extrabold leading-tight tracking-tight text-ink">{plan.name}</h3>
          {plan.description ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium text-ink-muted">{plan.description}</p>
          ) : null}
        </div>
        {plan.isActive ? (
          subscribers > 0 ? (
            <Badge tone="positive" dot className="shrink-0">
              {subscribers} {subscribers === 1 ? 'customer' : 'customers'}
            </Badge>
          ) : (
            <Badge tone="neutral" className="shrink-0">No one yet</Badge>
          )
        ) : (
          <Badge tone="neutral" className="shrink-0">Retired</Badge>
        )}
      </div>

      {/* ── Price ─────────────────────────────────────────────────────── */}
      <div className="mx-4 flex items-end justify-between gap-3 rounded-2xl bg-surface-muted/70 px-4 py-3 sm:mx-5">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">A full month</p>
          <p className="stat-number text-2xl leading-none text-ink">
            {plan.quotedMonthlyPaise != null ? formatPaise(plan.quotedMonthlyPaise, { whole: true }) : '—'}
          </p>
        </div>
        {plan.unitPrice ? (
          <div className="text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">Rate</p>
            <p className="tnum text-sm font-extrabold text-brand">
              ₹{Number(plan.unitPrice).toFixed(2)}
              <span className="text-xs font-bold text-ink-muted">/{plan.unit}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Terms ─────────────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-2 p-4 pt-3 sm:p-5 sm:pt-3">
        <Term icon={<MilkDropIcon className="h-4 w-4" />} label="Per delivery" value={`${Number(plan.quantity)} ${plan.unit}`} />
        <Term icon={<CalendarIcon className="h-4 w-4" />} label="Frequency" value={FREQUENCY_LABEL[plan.frequency] ?? plan.frequency} />
        <Term icon={<slot.Icon className="h-4 w-4" />} label="Slot" value={slot.label} />
        {windows.length > 0 ? (
          <Term
            icon={<ClockIcon className="h-4 w-4" />}
            label={windows.length === 1 ? `${windows[0].label} window` : 'Windows'}
            value={windows.map((w) => (windows.length === 1 ? w.value : `${w.label} ${w.value}`)).join(' · ')}
          />
        ) : (
          <Term icon={<UsersIcon className="h-4 w-4" />} label="Subscribed" value={plan.isActive ? String(subscribers) : '—'} />
        )}
      </dl>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="mt-auto flex items-center gap-2 border-t border-border p-3 sm:px-5">
        <PlanEditor
          plan={plan}
          trigger={
            <Button variant="outline" size="md" className="w-full">
              <EditIcon className="h-4 w-4" />
              Edit
            </Button>
          }
        />
        {plan.isActive ? (
          <Button
            variant="outline"
            size="md"
            onClick={onRetire}
            className="shrink-0 text-caution hover:border-caution/40 hover:bg-caution-soft"
          >
            Retire
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${plan.name}`}
          title="Delete plan"
          className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-subtle shadow-xs transition-colors hover:border-critical/40 hover:bg-critical-soft hover:text-critical"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

/** One fact about a plan, as a small tile. */
function Term({ icon, label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface px-2.5 py-2">
      <dt className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">
        <span aria-hidden="true" className="text-ink-subtle">{icon}</span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-0.5 truncate text-sm font-bold text-ink">{value}</dd>
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
