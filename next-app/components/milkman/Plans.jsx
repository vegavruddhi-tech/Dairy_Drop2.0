'use client';

import { useState, useTransition, useMemo } from 'react';
import { toast } from 'sonner';

import { cn, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveMilkPlan, retireMilkPlan, deleteMilkPlan } from '@/actions/milkman.actions.js';
import { useT } from '@/i18n/provider.jsx';
import { MilkmanFilterBar } from './MilkmanFilterBar.jsx';
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
import { MILK_TYPES, QUANTITY_PRESETS, generatePlanDefaults } from '@/domain/planPresets.js';

const UNITS = [
  { value: 'L', label: 'Litres (लीटर)' },
  { value: 'ml', label: 'Millilitres (मि.ली.)' },
  { value: 'kg', label: 'Kilograms (किलो)' },
  { value: 'pcs', label: 'Pieces (पीस)' },
];

const FREQUENCIES = [
  { value: 'DAILY', label: 'Every day (प्रतिदिन)' },
  { value: 'ALTERNATE_DAYS', label: 'Alternate days (एक दिन छोड़कर)' },
  { value: 'WEEKLY', label: 'Weekly (साप्ताहिक)' },
  { value: 'MONTHLY', label: 'Monthly (मासिक)' },
];

/** What one of this unit is called, for "a price per litre". */
const UNIT_NOUN = { L: 'litre', ml: 'millilitre', kg: 'kilogram', g: 'gram', pcs: 'piece' };
const UNIT_NOUN_HI = { L: 'लीटर', ml: 'मि.ली.', kg: 'किलो', g: 'ग्राम', pcs: 'पीस' };

const PRICE_LABEL = {
  MONTHLY: (unit, isHi) => (isHi ? 'मासिक मूल्य / Monthly Price (₹)' : 'Monthly price (₹)'),
  PER_UNIT: (unit, isHi) =>
    isHi
      ? `प्रति ${UNIT_NOUN_HI[unit] ?? 'इकाई'} दर / Price per ${UNIT_NOUN[unit] ?? 'unit'} (₹)`
      : `Price per ${UNIT_NOUN[unit] ?? 'unit'} (₹)`,
  PER_DELIVERY: (unit, isHi) => (isHi ? 'प्रति डिलीवरी शुल्क / Price per delivery (₹)' : 'Price per delivery (₹)'),
};

const PRICE_HINT = {
  MONTHLY: (isHi) =>
    isHi
      ? 'महीने की सभी डिलीवरी में वितरित। ग्राहक केवल उसी का भुगतान करते हैं जो डिलीवर होता है।'
      : 'Spread across every delivery in the month. Customers pay only for what is actually delivered.',
  PER_UNIT: (isHi) =>
    isHi ? 'मासिक आंकड़ा इसी दर से निकाला जाता है।' : 'The monthly figure is worked out from this.',
  PER_DELIVERY: (isHi) =>
    isHi ? 'केवल वास्तविक रूप से हुई प्रत्येक डिलीवरी के लिए शुल्क लिया जाता है।' : 'Charged for each delivery that actually happens.',
};

const SLOTS = [
  { value: 'MORNING', label: 'Morning (सुबह)' },
  { value: 'EVENING', label: 'Evening (शाम)' },
  { value: 'BOTH', label: 'Morning & evening (सुबह और शाम)' },
];

export function PlanEditor({ plan, trigger }) {
  const { locale } = useT();
  const isHi = locale === 'hi';
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});
  const [selectedMilkType, setSelectedMilkType] = useState('cow_milk');
  const [selectedQtyPreset, setSelectedQtyPreset] = useState('1');

  const [basis, setBasis] = useState(plan?.monthlyPrice ? 'MONTHLY' : 'PER_UNIT');
  const [slot, setSlot] = useState(plan?.slot ?? 'MORNING');
  const [frequency, setFrequency] = useState(plan?.frequency ?? 'DAILY');
  const [name, setName] = useState(plan?.name ?? '1L Pure Cow Milk Daily');
  const [productName, setProductName] = useState(plan?.productName ?? 'Pure Cow Milk');
  const [quantity, setQuantity] = useState(
    plan?.quantity ? String(Number(plan.quantity)) : '1',
  );
  const [price, setPrice] = useState(
    plan
      ? plan.monthlyPrice
        ? String(Number(plan.monthlyPrice))
        : String(
            (
              Number(plan.pricePerDelivery) / (Number(plan.quantity) || 1)
            ).toFixed(2),
          )
      : '64.00',
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
    const milkType = MILK_TYPES.find((m) => m.id === milkTypeId) || MILK_TYPES[0];
    setPrice(
      basis === 'MONTHLY'
        ? defaults.monthlyPrice
        : String(Number(milkType.defaultPricePerLitre).toFixed(2)),
    );
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
        <Button onClick={() => setOpen(true)}>
          {plan ? (isHi ? 'बदलें (Edit)' : 'Edit') : (isHi ? '+ नया प्लान' : 'New plan')}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          plan
            ? isHi
              ? 'दूध प्लान संपादित करें (Edit Plan)'
              : 'Edit Milk Plan'
            : isHi
            ? 'नया दूध प्लान बनाएं (Create Milk Plan)'
            : 'Create New Milk Plan'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {isHi ? 'रद्द करें (Cancel)' : 'Cancel'}
            </Button>
            <Button
              form="plan-form"
              type="submit"
              loading={pending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-heading font-bold shadow-md shadow-blue-500/20 px-5 py-2.5 rounded-xl transition-all"
            >
              {isHi ? 'प्लान सेव करें (Save Plan)' : 'Save Plan'}
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
            const toastId = toast.loading(
              plan?.id
                ? isHi
                  ? 'प्लान अपडेट हो रहा है…'
                  : 'Updating plan…'
                : isHi
                ? 'प्लान तैयार हो रहा है…'
                : 'Creating plan…',
            );
            startTransition(async () => {
              const result = await saveMilkPlan({
                ...data,
                id: plan?.id,
                isActive: true,
              });
              if (result.ok) {
                toast.success(isHi ? 'प्लान सफलतापूर्वक सेव हुआ!' : 'Plan saved successfully!', { id: toastId });
                setErrors({});
              } else {
                setOpen(true);
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? (isHi ? 'प्लान सेव नहीं हो सका।' : 'Could not save that plan.'), {
                  id: toastId,
                });
              }
            });
          }}
        >
          {/* Quick Predefined Dropdown Selector */}
          <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
                <SparklesIcon className="h-3.5 w-3.5 text-brand" />
                <span>
                  {isHi ? 'क्विक प्रीसेट (नाम, दर और जानकारी स्वतः भरें)' : 'Quick Presets (Auto-fills name, price & info)'}
                </span>
              </span>
              <span className="text-[10px] font-medium text-ink-subtle">
                {isHi ? 'बाज़ार मानक दर' : 'Market Rate Standard'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  {isHi ? 'दूध का प्रकार चुनें' : 'Select Milk Type'}
                </label>
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
                <label className="block text-xs font-bold text-ink mb-1">
                  {isHi ? 'दैनिक मात्रा चुनें' : 'Select Daily Quantity'}
                </label>
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
            label={isHi ? 'प्लान का नाम (ग्राहकों को दिखाई देगा)' : 'Plan name (Visible to Customer)'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            placeholder="1L Pure Cow Milk Daily"
          />

          <Input
            name="productName"
            label={isHi ? 'क्या डिलीवर होगा (उत्पाद)' : 'What is delivered'}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            error={errors.productName}
            required
            placeholder="Pure Cow Milk"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              name="quantity"
              label={isHi ? 'प्रति डिलीवरी मात्रा' : 'Quantity per delivery'}
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
              label={isHi ? 'इकाई (Unit)' : 'Unit'}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              options={UNITS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              name="frequency"
              label={isHi ? 'डिलीवरी आवृत्ति (How often)' : 'How often'}
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value);
                applyPreset(selectedMilkType, quantity, event.target.value);
              }}
              options={FREQUENCIES}
            />
            <Select
              name="slot"
              label={isHi ? 'डिलीवरी समय / स्लॉट' : 'When'}
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              options={SLOTS}
            />
          </div>

          <Textarea
            name="description"
            label={isHi ? 'प्लान का विवरण (वैकल्पिक)' : 'Plan Description (Auto-generated or custom)'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />

          {/*
            The delivery window, for each slot the plan actually runs.
          */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/50 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
              {isHi ? 'डिलीवरी का समय क्या होगा?' : 'When do you reach the door?'}
            </p>

            {showMorning ? (
              <div>
                <p className="mb-1.5 text-sm font-bold text-ink">
                  {isHi ? 'सुबह (Morning)' : 'Morning'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="time"
                    name="morningStart"
                    label={isHi ? 'से (From)' : 'From'}
                    defaultValue={toTimeValue(plan?.morningStart) || '06:00'}
                    error={errors.morningStart}
                  />
                  <Input
                    type="time"
                    name="morningEnd"
                    label={isHi ? 'तक (To)' : 'To'}
                    defaultValue={toTimeValue(plan?.morningEnd) || '07:30'}
                    error={errors.morningEnd}
                  />
                </div>
              </div>
            ) : null}

            {showEvening ? (
              <div>
                <p className="mb-1.5 text-sm font-bold text-ink">
                  {isHi ? 'शाम (Evening)' : 'Evening'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="time"
                    name="eveningStart"
                    label={isHi ? 'से (From)' : 'From'}
                    defaultValue={toTimeValue(plan?.eveningStart) || '17:30'}
                    error={errors.eveningStart}
                  />
                  <Input
                    type="time"
                    name="eveningEnd"
                    label={isHi ? 'तक (To)' : 'To'}
                    defaultValue={toTimeValue(plan?.eveningEnd) || '19:00'}
                    error={errors.eveningEnd}
                  />
                </div>
              </div>
            ) : null}

            <p className="text-xs text-ink-muted">
              {isHi
                ? 'यह समय ग्राहकों को उनके प्लान पर दिखेगा, इसलिए ऐसा समय चुनें जिसे आप नियमित रख सकें।'
                : 'Your customers see this on their plan, so give yourself a range you can keep.'}
            </p>
          </div>

          <Select
            name="pricingBasis"
            label={isHi ? 'मूल्य निर्धारण का आधार' : 'How do you price it?'}
            value={basis}
            onChange={(event) => {
              const nextBasis = event.target.value;
              setBasis(nextBasis);
              const milkType = MILK_TYPES.find((m) => m.id === selectedMilkType) || MILK_TYPES[0];
              const defaults = generatePlanDefaults(selectedMilkType, quantity, frequency);
              setPrice(
                nextBasis === 'MONTHLY'
                  ? defaults.monthlyPrice
                  : String(Number(milkType.defaultPricePerLitre).toFixed(2)),
              );
            }}
            options={[
              {
                value: 'PER_UNIT',
                label: isHi
                  ? `प्रति ${UNIT_NOUN_HI[unit] ?? 'इकाई'} मूल्य (A price per ${UNIT_NOUN[unit] ?? 'unit'})`
                  : `A price per ${UNIT_NOUN[unit] ?? 'unit'}`,
              },
              { value: 'MONTHLY', label: isHi ? 'मासिक मूल्य (A monthly price)' : 'A monthly price' },
            ]}
          />

          <Input
            name="price"
            label={PRICE_LABEL[basis](unit, isHi)}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={errors.price}
            required
            hint={PRICE_HINT[basis](isHi)}
          />

          <PriceEstimate
            basis={basis}
            price={price}
            quantity={quantity}
            unit={unit}
            slot={slot}
            frequency={frequency}
            isHi={isHi}
          />
        </form>
      </Modal>
    </>
  );
}

const SLOT_META = {
  MORNING: { label: 'Morning', labelHi: 'सुबह (Morning)', Icon: SunIcon },
  EVENING: { label: 'Evening', labelHi: 'शाम (Evening)', Icon: MoonIcon },
  BOTH: { label: 'Morning & evening', labelHi: 'सुबह और शाम', Icon: SunIcon },
};

const FREQUENCY_LABEL_EN = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label]));
const FREQUENCY_LABEL_HI = {
  DAILY: 'प्रतिदिन (Every day)',
  ALTERNATE_DAYS: 'एक दिन छोड़कर (Alternate days)',
  WEEKLY: 'साप्ताहिक (Weekly)',
  MONTHLY: 'मासिक (Monthly)',
};

export function PlansViewWithFilters({ plans = [], subscriberCounts = {} }) {
  const { locale } = useT();
  const isHi = locale === 'hi';
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RETIRED'
  const [selectedSlot, setSelectedSlot] = useState('ALL'); // 'ALL' | 'MORNING' | 'EVENING' | 'BOTH'

  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const retiredPlans = useMemo(() => plans.filter((p) => !p.isActive), [plans]);

  const slotOptions = [
    { value: 'MORNING', label: isHi ? 'सुबह (Morning)' : 'Morning' },
    { value: 'EVENING', label: isHi ? 'शाम (Evening)' : 'Evening' },
    { value: 'BOTH', label: isHi ? 'दोनों समय (Both)' : 'Both Slots' },
  ];

  const statusTabs = [
    { value: 'ALL', label: isHi ? 'सभी प्लान' : 'All Plans', count: plans.length },
    { value: 'ACTIVE', label: isHi ? 'सक्रिय (On Offer)' : 'On Offer', count: activePlans.length },
    { value: 'RETIRED', label: isHi ? 'बंद (Retired)' : 'Retired', count: retiredPlans.length },
  ];

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((plan) => {
      if (statusTab === 'ACTIVE' && !plan.isActive) return false;
      if (statusTab === 'RETIRED' && plan.isActive) return false;

      if (selectedSlot !== 'ALL' && plan.slot !== selectedSlot) return false;

      if (q) {
        const name = (plan.name || '').toLowerCase();
        const desc = (plan.description || '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }

      return true;
    });
  }, [plans, search, statusTab, selectedSlot]);

  const hasActiveFilters = search.trim() !== '' || statusTab !== 'ALL' || selectedSlot !== 'ALL';
  const resetFilters = () => {
    setSearch('');
    setStatusTab('ALL');
    setSelectedSlot('ALL');
  };

  return (
    <div className="space-y-6">
      <MilkmanFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isHi ? 'दूध का प्रकार या प्लान खोजें...' : 'Search plans by name or milk type...'}
        slots={slotOptions}
        selectedSlot={selectedSlot}
        onSlotChange={setSelectedSlot}
        allSlotsLabel={isHi ? 'सभी स्लॉट (All Slots)' : 'All Slots'}
        statusTabs={statusTabs}
        selectedStatus={statusTab}
        onStatusChange={setStatusTab}
        totalCount={plans.length}
        filteredCount={filteredPlans.length}
        onReset={resetFilters}
        isHi={isHi}
      />

      {filteredPlans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center mb-6">
          <p className="font-heading text-sm font-bold text-slate-800">
            {isHi ? 'कोई प्लान नहीं मिला' : 'No matching plans'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isHi ? 'फ़िल्टर बदलें या रीसेट करें।' : 'Try changing your search terms or filter selection.'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="tap mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-all"
          >
            {isHi ? 'फ़िल्टर रीसेट करें' : 'Reset filters'}
          </button>
        </div>
      ) : (
        <PlanList plans={filteredPlans} subscriberCounts={subscriberCounts} />
      )}
    </div>
  );
}

/**
 * The plan cards, with retire and delete behind confirm sheets.
 */
export function PlanList({ plans, subscriberCounts = {} }) {
  const { locale } = useT();
  const isHi = locale === 'hi';
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(null); // { kind: 'retire' | 'delete', plan }

  function run() {
    const { kind, plan } = confirm;
    startTransition(async () => {
      const result = kind === 'delete' ? await deleteMilkPlan({ id: plan.id }) : await retireMilkPlan({ id: plan.id });
      if (result.ok) {
        const ended = result.data?.ended ?? 0;
        const verb = kind === 'delete' ? (isHi ? 'डिलीट कर दिया गया' : 'deleted') : (isHi ? 'बंद (Retire) कर दिया गया' : 'retired');
        toast.success(
          ended > 0
            ? isHi
              ? `प्लान ${verb}। ${ended} ग्राहकों का सब्सक्रिप्शन समाप्त हुआ।`
              : `Plan ${verb}. ${ended} subscription${ended === 1 ? '' : 's'} ended.`
            : isHi
            ? `प्लान ${verb}।`
            : `Plan ${verb}.`,
        );
        setConfirm(null);
      } else {
        toast.error(result.message ?? (isHi ? 'प्लान अपडेट नहीं किया जा सका।' : `Could not ${kind} that plan.`));
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
            isHi={isHi}
          />
        ))}
      </div>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm
            ? `${confirm.kind === 'delete' ? (isHi ? 'डिलीट करें' : 'Delete') : (isHi ? 'बंद करें (Retire)' : 'Retire')} ${confirm.plan.name}?`
            : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {isHi ? 'रखें (Keep it)' : 'Keep it'}
            </Button>
            <Button variant="danger" loading={pending} onClick={run}>
              {confirm?.kind === 'delete' ? <TrashIcon className="h-4 w-4" /> : null}
              {confirm?.kind === 'delete'
                ? isHi
                  ? 'प्लान हटाएं (Delete plan)'
                  : 'Delete plan'
                : isHi
                ? 'प्लान बंद करें (Retire plan)'
                : 'Retire plan'}
            </Button>
          </>
        }
      >
        {confirm ? (
          <div className="space-y-3 text-sm text-ink-muted">
            {on > 0 ? (
              <p className="rounded-xl border border-caution/25 bg-caution-soft px-3 py-2 text-xs font-semibold text-caution">
                {isHi
                  ? `${on} ग्राहक इस प्लान पर जुड़े हैं। आज से उनकी डिलीवरी बंद हो जाएगी और उन्हें दूसरा प्लान चुनने को कहा जाएगा। पहले डिलीवर किए गए दिनों का बिल रहेगा।`
                  : `${on} ${on === 1 ? 'customer is' : 'customers are'} on this plan. Their deliveries stop from today and they are told to pick another plan. Days already delivered stay billed.`}
              </p>
            ) : (
              <p>{isHi ? 'इस प्लान पर कोई ग्राहक नहीं है, इसलिए डिलीवरी में कोई बदलाव नहीं होगा।' : 'Nobody is on it, so no deliveries change.'}</p>
            )}
            {confirm.kind === 'delete' ? (
              <p>
                {isHi
                  ? 'यह प्लान हमेशा के लिए हटा दिया जाएगा। पुराने बिल अप्रभावित रहेंगे।'
                  : 'The plan is removed for good, along with any pending requests to switch onto it. Past bills are unaffected — they keep the prices that were charged.'}
              </p>
            ) : (
              <p>
                {isHi
                  ? 'यह दुकान से हट जाएगा लेकिन रिकॉर्ड में "Retired" सेक्शन में सुरक्षित रहेगा।'
                  : 'It leaves the shop but stays on record under “Retired”. Choose Delete if you want it gone.'}
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/** One plan. */
function PlanCard({ plan, subscribers, onRetire, onDelete, isHi }) {
  const slot = SLOT_META[plan.slot] ?? SLOT_META.MORNING;
  const morning = formatWindow(plan.morningStart, plan.morningEnd);
  const evening = formatWindow(plan.eveningStart, plan.eveningEnd);
  const windows = [
    plan.slot !== 'EVENING' && morning
      ? { label: isHi ? 'सुबह' : 'Morning', value: morning, Icon: SunIcon }
      : null,
    plan.slot !== 'MORNING' && evening
      ? { label: isHi ? 'शाम' : 'Evening', value: evening, Icon: MoonIcon }
      : null,
  ].filter(Boolean);

  const freqLabel = isHi
    ? FREQUENCY_LABEL_HI[plan.frequency] ?? plan.frequency
    : FREQUENCY_LABEL_EN[plan.frequency] ?? plan.frequency;

  return (
    <article
      className={cn(
        'card-surface relative flex flex-col overflow-hidden transition-shadow hover:shadow-card-hover',
        plan.isActive ? '' : 'opacity-75',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-1',
          plan.isActive ? 'bg-hero-gradient' : 'bg-border',
        )}
      />

      {/* ── Head ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            plan.isActive ? 'bg-brand-soft text-brand' : 'bg-surface-muted text-ink-subtle',
          )}
        >
          <MilkDropIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">{plan.productName}</p>
          <h3 className="font-heading text-base font-extrabold leading-tight tracking-tight text-ink">
            {plan.name}
          </h3>
          {plan.description ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium text-ink-muted">{plan.description}</p>
          ) : null}
        </div>
        {plan.isActive ? (
          subscribers > 0 ? (
            <Badge tone="positive" dot className="shrink-0">
              {subscribers} {isHi ? 'ग्राहक' : subscribers === 1 ? 'customer' : 'customers'}
            </Badge>
          ) : (
            <Badge tone="neutral" className="shrink-0">
              {isHi ? 'अभी कोई नहीं' : 'No one yet'}
            </Badge>
          )
        ) : (
          <Badge tone="neutral" className="shrink-0">
            {isHi ? 'बंद (Retired)' : 'Retired'}
          </Badge>
        )}
      </div>

      {/* ── Price ─────────────────────────────────────────────────────── */}
      <div className="mx-4 flex items-end justify-between gap-3 rounded-2xl bg-surface-muted/70 px-4 py-3 sm:mx-5">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">
            {isHi ? 'पूरे महीने का' : 'A full month'}
          </p>
          <p className="stat-number text-2xl leading-none text-ink">
            {plan.quotedMonthlyPaise != null ? formatPaise(plan.quotedMonthlyPaise, { whole: true }) : '—'}
          </p>
        </div>
        {plan.unitPrice ? (
          <div className="text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">
              {isHi ? 'दर (Rate)' : 'Rate'}
            </p>
            <p className="tnum text-sm font-extrabold text-brand">
              ₹{Number(plan.unitPrice).toFixed(2)}
              <span className="text-xs font-bold text-ink-muted">/{plan.unit}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Terms ─────────────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-2 p-4 pt-3 sm:p-5 sm:pt-3">
        <Term
          icon={<MilkDropIcon className="h-4 w-4" />}
          label={isHi ? 'प्रति डिलीवरी' : 'Per delivery'}
          value={`${Number(plan.quantity)} ${plan.unit}`}
        />
        <Term
          icon={<CalendarIcon className="h-4 w-4" />}
          label={isHi ? 'आवृत्ति' : 'Frequency'}
          value={freqLabel}
        />
        <Term
          icon={<slot.Icon className="h-4 w-4" />}
          label={isHi ? 'समय' : 'Slot'}
          value={isHi ? slot.labelHi : slot.label}
        />
        {windows.length > 0 ? (
          <Term
            icon={<ClockIcon className="h-4 w-4" />}
            label={windows.length === 1 ? (isHi ? `${windows[0].label} समय` : `${windows[0].label} window`) : (isHi ? 'समय विंडो' : 'Windows')}
            value={windows.map((w) => (windows.length === 1 ? w.value : `${w.label} ${w.value}`)).join(' · ')}
          />
        ) : (
          <Term
            icon={<UsersIcon className="h-4 w-4" />}
            label={isHi ? 'सब्सक्राइबर्स' : 'Subscribed'}
            value={plan.isActive ? String(subscribers) : '—'}
          />
        )}
      </dl>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="mt-auto flex items-center gap-2 border-t border-border p-3 sm:px-5">
        <PlanEditor
          plan={plan}
          trigger={
            <Button variant="outline" size="md" className="w-full">
              <EditIcon className="h-4 w-4" />
              {isHi ? 'बदलें (Edit)' : 'Edit'}
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
            {isHi ? 'हटाएं (Retire)' : 'Retire'}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${plan.name}`}
          title={isHi ? 'प्लान डिलीट करें' : 'Delete plan'}
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
        <span aria-hidden="true" className="text-ink-subtle">
          {icon}
        </span>
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
 * A live read-out of what the plan costs.
 */
function PriceEstimate({ basis, price, quantity, unit, slot, frequency, isHi }) {
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
        {isHi ? 'अनुमानित कुल हिसाब' : 'What this comes to'}
      </p>
      <dl className="space-y-1.5 text-sm">
        <Line
          label={isHi ? `प्रति ${UNIT_NOUN_HI[unit] ?? 'इकाई'}` : `Per ${UNIT_NOUN[unit] ?? 'unit'}`}
          value={`₹${Number(rate.unitPrice).toFixed(2)}`}
        />
        <Line
          label={
            isHi
              ? `प्रति डिलीवरी (${Number(quantity)} ${unit})`
              : `Per delivery (${Number(quantity)} ${unit})`
          }
          value={formatPaise(rate.perDeliveryPaise)}
        />
        <Line
          label={
            isHi
              ? `इस महीने में कुल डिलीवरी (${perDay} प्रतिदिन)`
              : `Deliveries this month (${perDay} a day)`
          }
          value={String(drops)}
        />
        <div className="flex items-center justify-between border-t border-border pt-1.5">
          <dt className="font-medium text-ink">{isHi ? 'पूरे महीने का शुल्क' : 'A full month'}</dt>
          <dd className="tnum font-semibold text-ink">{formatPaise(monthly, { whole: true })}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-muted">
        {isHi
          ? `${month} के लिए अनुमानित गणना। ग्राहकों को केवल वास्तव में डिलीवर किए गए दिनों का बिल भेजा जाता है।`
          : `An estimate for ${month}. Customers are billed only for deliveries that happen.`}
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
