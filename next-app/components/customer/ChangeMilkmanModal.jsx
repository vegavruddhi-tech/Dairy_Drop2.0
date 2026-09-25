'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Modal, Button, Input } from '@/components/ui/interactive.jsx';
import { formatPaise } from '@/domain/money.js';
import { switchMilkman } from '@/actions/customer.actions.js';

export function ChangeMilkmanModal({
  open,
  onClose,
  currentMilkman,
  balancePaise = 0,
  customerAddress,
}) {
  const hasUnpaidDues = balancePaise > 0;
  const [step, setStep] = useState('search'); // 'search' | 'plans'
  const [pincode, setPincode] = useState(customerAddress?.pincode || '');
  const [selectedArea, setSelectedArea] = useState(customerAddress?.area || '');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [milkmen, setMilkmen] = useState([]);
  const [selectedMilkman, setSelectedMilkman] = useState(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [pending, startTransition] = useTransition();

  const handleLookup = async (pincodeToSearch) => {
    const code = String(pincodeToSearch || pincode).trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Please enter a valid 6-digit pincode.');
      return;
    }

    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/serviceability?pincode=${code}`);
      const data = await res.json();
      if (res.ok) {
        // Filter out current milkman
        const filtered = (data.milkmen || []).filter(
          (m) => m.id !== currentMilkman?.id && m.tenantId !== currentMilkman?.id,
        );
        setMilkmen(filtered);
        if (filtered.length === 0) {
          toast.info('No other dairy providers currently serve this pincode.');
        }
      } else {
        toast.error(data.message || 'Could not fetch dairy providers.');
      }
    } catch (err) {
      toast.error('Failed to search providers.');
    } finally {
      setLoadingSearch(false);
    }
  };

  useEffect(() => {
    if (open && !hasUnpaidDues && customerAddress?.pincode) {
      setPincode(customerAddress.pincode);
      setSelectedArea(customerAddress.area || '');
      handleLookup(customerAddress.pincode);
    }
  }, [open, hasUnpaidDues, customerAddress?.pincode]);

  const togglePlan = (planId) => {
    setSelectedPlanIds((prev) => {
      if (prev.includes(planId)) return prev.filter((id) => id !== planId);
      if (prev.length >= 2) {
        toast.error('You can select a maximum of 2 milk plans.');
        return prev;
      }
      return [...prev, planId];
    });
  };

  const handleConfirmSwitch = () => {
    if (!selectedMilkman) {
      toast.error('Please select a dairy provider.');
      return;
    }

    startTransition(async () => {
      const res = await switchMilkman({
        newMilkmanId: selectedMilkman.id,
        pincode: pincode.trim(),
        area: selectedArea.trim() || customerAddress?.area || 'Local Area',
        planIds: selectedPlanIds,
      });

      if (res.ok) {
        toast.success(
          `Switched to ${selectedMilkman.businessName}! Your new milkman will approve your deliveries.`,
        );
        onClose();
        window.location.reload();
      } else {
        toast.error(res.message || 'Could not complete dairy switch.');
      }
    });
  };

  // ── 1. Unpaid Dues Alert Screen ──────────────────────────────────────────
  if (hasUnpaidDues) {
    return (
      <Modal open={open} onClose={onClose} title="Change Dairy Provider">
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">
            <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>

          <div>
            <h3 className="font-heading text-base font-extrabold text-slate-900">
              Outstanding Dues Pending
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              You have an unpaid balance of{' '}
              <span className="font-black text-rose-600 font-heading">
                {formatPaise(balancePaise)}
              </span>{' '}
              with your current milkman (
              <span className="font-bold text-slate-900">
                {currentMilkman?.businessName || 'Current Milkman'}
              </span>
              ).
            </p>
            <p className="mt-1 text-[11px] text-slate-400 font-medium">
              All previous month & running dues must be settled before you can switch to another dairy provider.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 text-left font-medium">
            💡 Once payment is completed on the billing page, you can return here and immediately choose a new milkman.
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full sm:w-auto order-2 sm:order-1 text-slate-500"
            >
              Close
            </Button>
            <Link href="/billing" className="w-full sm:flex-1 order-1 sm:order-2">
              <Button type="button" className="w-full font-bold">
                Pay Bill ({formatPaise(balancePaise)}) →
              </Button>
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  // ── 2. Milkman & Plans Selection Step ────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'plans' ? `Select Plans • ${selectedMilkman?.businessName}` : 'Choose New Dairy Provider'}
      footer={
        <div className="flex w-full items-center justify-between gap-2.5">
          {step === 'plans' ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setStep('search')}>
              ← Back to Milkmen
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          )}

          {step === 'plans' ? (
            <Button
              type="button"
              onClick={handleConfirmSwitch}
              loading={pending}
              className="font-bold whitespace-nowrap"
            >
              Confirm Switch ({selectedPlanIds.length} {selectedPlanIds.length === 1 ? 'Plan' : 'Plans'})
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!selectedMilkman}
              onClick={() => setStep('plans')}
              className="font-bold"
            >
              Next: Select Plans →
            </Button>
          )}
        </div>
      }
    >
      {step === 'search' ? (
        <div className="space-y-4">
          {/* Pincode Search Bar */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Delivery Pincode
            </label>
            <div className="flex gap-2">
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="6-digit pincode"
                maxLength={6}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handleLookup(pincode)}
                loading={loadingSearch}
                className="shrink-0"
              >
                Search
              </Button>
            </div>
          </div>

          {/* List of Available Milkmen */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Available Dairy Providers ({milkmen.length})
            </label>

            {loadingSearch ? (
              <div className="p-8 text-center text-xs text-slate-400">Searching providers...</div>
            ) : milkmen.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                No other verified milkmen found for pincode <span className="font-bold text-slate-800">{pincode}</span>.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {milkmen.map((m) => {
                  const isSelected = selectedMilkman?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMilkman(m);
                        setSelectedPlanIds([]);
                      }}
                      className={`flex items-start justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-heading text-sm font-bold text-slate-900">{m.businessName}</p>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{m.name} • {m.phone}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {m.plans?.length || 0} active milk plans available
                        </p>
                      </div>

                      <div className="ml-3 shrink-0 pt-0.5">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Step 2: Select Milk Plans */
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
            Select up to <span className="font-bold">2 milk plans</span> to receive daily from{' '}
            <span className="font-bold text-slate-900">{selectedMilkman?.businessName}</span>.
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(selectedMilkman?.plans || []).length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                This dairy has no public milk plans currently listed. You can still switch and request plans directly.
              </p>
            ) : (
              (selectedMilkman?.plans || []).map((plan) => {
                const isSelected = selectedPlanIds.includes(plan.id);
                return (
                  <div
                    key={plan.id}
                    onClick={() => togglePlan(plan.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-sm font-bold text-slate-900">{plan.productName}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {plan.quantity} {plan.unit} • {plan.frequency} • {plan.slot}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="font-heading text-sm font-black text-slate-900">
                        ₹{Number(plan.unitPrice || plan.price || 0).toFixed(2)}
                        <span className="text-[10px] font-normal text-slate-400">/{plan.unit}</span>
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
