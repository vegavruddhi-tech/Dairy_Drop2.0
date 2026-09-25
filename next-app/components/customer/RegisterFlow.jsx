'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Card, CardBody, EmptyState } from '@/components/ui/index.jsx';
import { Button, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { registerWithMilkman } from '@/actions/customer.actions.js';
import { useFormDraft } from '@/lib/useFormDraft.js';

/**
 * Modern High-Aesthetic Blue & White Customer Onboarding Wizard (English).
 * ZERO EMOJIS - Clean vector SVG icons only.
 * Full form state persistence across login/signup redirects & refreshes.
 * 3-step setup: 1. Pincode -> 2. Select Dairy -> 3. Sector, Address & Milk Plans (Max 2 Plans).
 */
export function RegisterFlow({ defaultName }) {
  const {
    draft,
    saveDraft,
    clearDraft,
    isRestored,
    isInitialized,
  } = useFormDraft('dairydrop_draft_customer_register', {
    step: 'pincode',
    pincode: '',
    result: null,
    milkman: null,
    selectedPlanIds: [],
    name: defaultName || '',
    phone: '',
    area: '',
    line1: '',
    line2: '',
    deliveryInstructions: '',
  });

  const [step, setStep] = useState('pincode'); // 'pincode' | 'milkman' | 'details'
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState(null);
  const [milkman, setMilkman] = useState(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [formData, setFormData] = useState({
    name: defaultName || '',
    phone: '',
    area: '',
    line1: '',
    line2: '',
    deliveryInstructions: '',
  });

  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  // Sync draft state to local states when loaded
  useEffect(() => {
    if (isInitialized && draft) {
      if (draft.step) setStep(draft.step);
      if (draft.pincode) setPincode(draft.pincode);
      if (draft.result) setResult(draft.result);
      if (draft.milkman) setMilkman(draft.milkman);
      if (Array.isArray(draft.selectedPlanIds)) setSelectedPlanIds(draft.selectedPlanIds);
      setFormData({
        name: draft.name || defaultName || '',
        phone: draft.phone || '',
        area: draft.area || '',
        line1: draft.line1 || '',
        line2: draft.line2 || '',
        deliveryInstructions: draft.deliveryInstructions || '',
      });
    }
  }, [isInitialized]);

  async function lookup(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('pincode');

    startTransition(async () => {
      const response = await fetch(`/api/serviceability?pincode=${value}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message ?? 'Please enter a valid 6-digit pincode.');
        return;
      }

      const pCode = String(value);
      setPincode(pCode);
      setResult(data);
      setStep('milkman');

      saveDraft({
        step: 'milkman',
        pincode: pCode,
        result: data,
      });
    });
  }

  function handleSelectDairy(option) {
    setMilkman(option);
    const initialPlans = option.plans?.length > 0 ? [option.plans[0].id] : [];
    setSelectedPlanIds(initialPlans);
    setStep('details');

    saveDraft({
      milkman: option,
      selectedPlanIds: initialPlans,
      step: 'details',
    });
  }

  function togglePlan(planId) {
    setSelectedPlanIds((prev) => {
      let next;
      if (prev.includes(planId)) {
        next = prev.filter((id) => id !== planId);
      } else {
        if (prev.length >= 2) {
          toast.error('You can select a maximum of 2 milk plans at a time.');
          return prev;
        }
        next = [...prev, planId];
      }
      saveDraft({ selectedPlanIds: next });
      return next;
    });
  }

  function handleInputChange(field, value) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      saveDraft({ [field]: value });
      return updated;
    });
  }

  function submit(event) {
    event.preventDefault();
    const currentData = {
      ...formData,
      ...Object.fromEntries(new FormData(event.currentTarget)),
    };

    startTransition(async () => {
      const response = await registerWithMilkman({
        ...currentData,
        milkmanId: milkman.id,
        pincode,
        planIds: selectedPlanIds,
      });

      if (response.ok) {
        clearDraft();
        toast.success('Registration request sent! Your milkman will approve your daily delivery.');
        window.location.href = '/pending';
      } else {
        setErrors(response.fieldErrors ?? {});
        toast.error(response.message ?? 'Could not complete registration.');
      }
    });
  }

  // 3 Step Numbering
  const stepNumber = step === 'pincode' ? 1 : step === 'milkman' ? 2 : 3;

  return (
    <div className="space-y-6">
      {/* Draft Restored Pill Notice */}
      {isRestored && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50/80 border border-blue-200 px-4 py-2.5 text-xs text-blue-900 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-semibold">
              Restored your saved registration form from previous session.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setStep('pincode');
              setPincode('');
              setResult(null);
              setMilkman(null);
              setSelectedPlanIds([]);
              setFormData({
                name: defaultName || '',
                phone: '',
                area: '',
                line1: '',
                line2: '',
                deliveryInstructions: '',
              });
              toast.info('Form draft reset to start.');
            }}
            className="font-bold text-blue-700 hover:text-blue-800 underline shrink-0"
          >
            Start Over
          </button>
        </div>
      )}

      {/* Blue & White Step Indicator Bar */}
      <div className="flex items-center justify-between gap-1.5 rounded-2xl bg-white p-2 border border-slate-200/90 shadow-sm">
        {[
          { num: 1, label: 'Pincode' },
          { num: 2, label: 'Choose Dairy' },
          { num: 3, label: 'Address & Plans' },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
              stepNumber === s.num
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : stepNumber > s.num
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                stepNumber === s.num
                  ? 'bg-white/20 text-white'
                  : stepNumber > s.num
                  ? 'bg-blue-200/60 text-blue-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {stepNumber > s.num ? '✓' : s.num}
            </span>
            <span className="hidden xs:inline">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── STEP 1: PINCODE LOOKUP ────────────────────────────────────────── */}
      {step === 'pincode' && (
        <div className="space-y-5 animate-fade-in">
          <header className="text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              Step 1 of 3 • Delivery Pincode
            </span>
            <h1 className="mt-2.5 font-heading text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Find Milkmen in Your Area
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Enter your 6-digit delivery pincode to discover verified local dairies serving your doorstep.
            </p>
          </header>

          <Card className="border-2 border-blue-200/80 shadow-xl shadow-blue-500/5 bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden">
            <CardBody className="p-6 sm:p-7">
              <form onSubmit={lookup} className="space-y-4">
                <Input
                  name="pincode"
                  label="Delivery Pincode (6-Digit)"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  defaultValue={pincode}
                  placeholder="e.g. 122001 or 110001"
                  required
                  autoFocus
                />
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 font-semibold shadow-md shadow-blue-600/25"
                  size="lg"
                  loading={pending}
                >
                  Find Milkmen Near Me →
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Quick Switch for Milkmen */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-slate-700">
              Are you a Milkman or Dairy Owner looking to sell milk?
            </p>
            <Link
              href="/become-a-milkman"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 underline"
            >
              <span>Apply as Milkman / Dairy Vendor →</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── STEP 2: CHOOSE A MILKMAN ──────────────────────────────────────── */}
      {step === 'milkman' && (
        <div className="space-y-5 animate-fade-in">
          {!result?.serviceable ? (
            <EmptyState
              icon={
                <svg className="h-10 w-10 text-slate-400 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              }
              title={`No milkman in ${pincode} yet`}
              description="We are expanding to new sectors every week. You can try a neighbouring pincode or apply as a milkman to serve this area!"
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep('pincode');
                      saveDraft({ step: 'pincode' });
                    }}
                  >
                    Try Another Pincode
                  </Button>
                  <Link href="/become-a-milkman">
                    <Button variant="ghost">Sell Milk in {pincode}</Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <>
              <header className="text-left">
                <button
                  type="button"
                  onClick={() => {
                    setStep('pincode');
                    saveDraft({ step: 'pincode' });
                  }}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <span>←</span> Change pincode ({pincode})
                </button>
                <div className="flex items-center justify-between">
                  <h1 className="font-heading text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                    Available Dairies in {pincode}
                  </h1>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                    {result.milkmen.length} Available
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Select your preferred verified dairy to receive pure morning milk deliveries.
                </p>
              </header>

              <div className="space-y-3">
                {result.milkmen.map((option) => (
                  <div
                    key={option.id}
                    className="group flex flex-col justify-between gap-3 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-600 hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-heading font-bold text-slate-900 text-base">
                            {option.businessName}
                          </p>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                            Verified Dairy
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          <strong>Delivering to:</strong>{' '}
                          {option.areas?.map((area) => area.areaName).slice(0, 3).join(', ') || 'All sectors'}
                          {option.areas?.length > 3 ? ` +${option.areas.length - 3} more` : ''}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleSelectDairy(option)}
                        className="shrink-0 bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm"
                      >
                        Choose Dairy →
                      </Button>
                    </div>

                    {/* Show available plans preview */}
                    {option.plans && option.plans.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider self-center">
                          Offered:
                        </span>
                        {option.plans.map((p) => (
                          <span
                            key={p.id}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                          >
                            {p.productName} ({p.quantity} {p.unit}) • ₹{p.monthlyPrice || p.pricePerDelivery}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full font-semibold"
                onClick={() => {
                  setStep('pincode');
                  saveDraft({ step: 'pincode' });
                }}
              >
                Search Different Pincode
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: ADDRESS, SECTOR & MILK PLANS (MAX 2 PLANS) ─────────────── */}
      {step === 'details' && milkman && (
        <div className="space-y-5 animate-fade-in">
          <header className="text-left">
            <button
              type="button"
              onClick={() => {
                setStep('milkman');
                saveDraft({ step: 'milkman' });
              }}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <span>←</span> Choose different dairy
            </button>
            <h1 className="font-heading text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Delivery Details & Milk Plans
            </h1>
            <p className="text-xs text-slate-600">
              Select your sector, choose up to 2 daily milk plans, and enter your delivery address.
            </p>
          </header>

          <Card className="border border-slate-200/90 shadow-xl shadow-blue-500/5 bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden">
            <CardBody className="p-6 sm:p-7 space-y-6">
              {/* Selected Milkman Banner */}
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-base shadow-md shadow-blue-600/25">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Selected Milkman
                    </p>
                    <p className="font-heading font-bold text-slate-900 text-sm sm:text-base">
                      {milkman.businessName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('milkman');
                    saveDraft({ step: 'milkman' });
                  }}
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  Change
                </button>
              </div>

              <form onSubmit={submit} className="space-y-6">
                {/* ── 1. SELECT MILK PLANS (MAX 2) ───────────────────────── */}
                <div className="space-y-3 rounded-2xl bg-slate-50/80 border border-slate-200/90 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-sm font-bold text-slate-900">
                        Choose Daily Milk Plans
                      </h3>
                      <p className="text-xs text-slate-500">
                        Select 1 or 2 plans for morning doorstep delivery.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        selectedPlanIds.length === 2
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedPlanIds.length} of 2 Plans Selected
                    </span>
                  </div>

                  {/* Plan Cards Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    {milkman.plans && milkman.plans.length > 0 ? (
                      milkman.plans.map((plan) => {
                        const isSelected = selectedPlanIds.includes(plan.id);
                        return (
                          <div
                            key={plan.id}
                            onClick={() => togglePlan(plan.id)}
                            className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-white ring-2 ring-blue-600/20 shadow-md shadow-blue-500/10'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-heading text-sm font-bold text-slate-900">
                                  {plan.productName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {plan.quantity} {plan.unit} • {plan.frequency}
                                </p>
                              </div>
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 bg-white text-transparent'
                                }`}
                              >
                                ✓
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                              <span className="text-slate-500">Rate:</span>
                              <span className="font-heading font-bold text-blue-600">
                                ₹{plan.monthlyPrice ? `${plan.monthlyPrice}/mo` : `${plan.pricePerDelivery}/drop`}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="sm:col-span-2 text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                        Default subscription: 1.5L Pure Farm Fresh Milk will be assigned.
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 2. SECTOR & PERSONAL DETAILS ───────────────────────── */}
                <div className="space-y-4">
                  <h3 className="font-heading text-sm font-bold text-slate-900">
                    Delivery Address & Contact
                  </h3>

                  <Input
                    name="name"
                    label="Your Full Name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={errors.name}
                    placeholder="e.g. Rahul Sharma"
                    required
                  />

                  <Input
                    name="phone"
                    label="Mobile Number (for Delivery Updates)"
                    inputMode="tel"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    error={errors.phone}
                    placeholder="9876543210"
                    hint="Your milkman will use this number for delivery coordination."
                    required
                  />

                  {/* Route / Sector selection from Milkman's covered areas */}
                  {(() => {
                    const matched = milkman.areas?.filter((a) => a.pincode === pincode) || [];
                    const options = (matched.length > 0 ? matched : milkman.areas || []).map((a) => ({
                      value: a.areaName,
                      label: a.pincode ? `${a.areaName} (${a.pincode})` : a.areaName,
                    }));

                    if (options.length > 0) {
                      return (
                        <Select
                          name="area"
                          label="Delivery Sector / Society"
                          options={options}
                          value={formData.area || options[0].value}
                          onChange={(e) => handleInputChange('area', e.target.value)}
                          required
                        />
                      );
                    }
                    return (
                      <Input
                        name="area"
                        label="Delivery Sector / Society"
                        placeholder="e.g. Sector 59, Sector 79, Green Valley"
                        value={formData.area}
                        onChange={(e) => handleInputChange('area', e.target.value)}
                        required
                      />
                    );
                  })()}

                  <Input
                    name="line1"
                    label="Flat / House No. & Building Name"
                    value={formData.line1}
                    onChange={(e) => handleInputChange('line1', e.target.value)}
                    error={errors.line1}
                    placeholder="Flat 402, Tower B, Palm Heights"
                    required
                  />

                  <Input
                    name="line2"
                    label="Street / Landmark (Optional)"
                    value={formData.line2}
                    onChange={(e) => handleInputChange('line2', e.target.value)}
                    placeholder="Near Central Park or Main Gate"
                  />

                  <Textarea
                    name="deliveryInstructions"
                    label="Special Delivery Instructions (Optional)"
                    value={formData.deliveryInstructions}
                    onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                    placeholder="e.g. Leave bottle in milk bag at door, ring bell once."
                    maxLength={500}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 font-semibold shadow-md shadow-blue-600/25 py-3.5"
                  size="lg"
                  loading={pending}
                >
                  Submit Delivery Request →
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
