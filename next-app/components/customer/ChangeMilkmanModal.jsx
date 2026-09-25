'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Modal, Button, Input } from '@/components/ui/interactive.jsx';
import { formatPaise } from '@/domain/money.js';
import { switchMilkman } from '@/actions/customer.actions.js';
import { useT } from '@/i18n/provider.jsx';

export function ChangeMilkmanModal({
  open,
  onClose,
  currentMilkman,
  balancePaise = 0,
  customerAddress,
}) {
  const { locale } = useT();
  const isHi = locale === 'hi';
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
      toast.error(isHi ? 'कृपया 6 अंकों का सही पिनकोड दर्ज करें।' : 'Please enter a valid 6-digit pincode.');
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
          toast.info(isHi ? 'इस पिनकोड पर वर्तमान में कोई अन्य डेयरी प्रदाता उपलब्ध नहीं है।' : 'No other dairy providers currently serve this pincode.');
        }
      } else {
        toast.error(data.message || (isHi ? 'डेयरी प्रदाताओं को लोड नहीं किया जा सका।' : 'Could not fetch dairy providers.'));
      }
    } catch (err) {
      toast.error(isHi ? 'प्रदाताओं को खोजने में विफल।' : 'Failed to search providers.');
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
        toast.error(isHi ? 'आप अधिकतम 2 दूध प्लान चुन सकते हैं।' : 'You can select a maximum of 2 milk plans.');
        return prev;
      }
      return [...prev, planId];
    });
  };

  const handleConfirmSwitch = () => {
    if (!selectedMilkman) {
      toast.error(isHi ? 'कृपया एक डेयरी प्रदाता चुनें।' : 'Please select a dairy provider.');
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
          isHi
            ? `${selectedMilkman.businessName} में बदल दिया गया! आपका नया दूधवाला आपकी डिलीवरी को स्वीकृत करेगा।`
            : `Switched to ${selectedMilkman.businessName}! Your new milkman will approve your deliveries.`,
        );
        onClose();
        window.location.reload();
      } else {
        toast.error(res.message || (isHi ? 'डेयरी बदलना पूरा नहीं हो सका।' : 'Could not complete dairy switch.'));
      }
    });
  };

  // ── 1. Unpaid Dues Alert Screen ──────────────────────────────────────────
  if (hasUnpaidDues) {
    return (
      <Modal open={open} onClose={onClose} title={isHi ? 'डेयरी प्रदाता बदलें' : 'Change Dairy Provider'}>
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">
            <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>

          <div>
            <h3 className="font-heading text-base font-extrabold text-slate-900">
              {isHi ? 'बकाया राशि लंबित है' : 'Outstanding Dues Pending'}
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              {isHi ? 'आपके वर्तमान दूधवाले (' : 'You have an unpaid balance of '}
              {isHi ? (
                <>
                  <span className="font-bold text-slate-900">
                    {currentMilkman?.businessName || 'Current Milkman'}
                  </span>
                  ) के पास{' '}
                  <span className="font-black text-rose-600 font-heading">
                    {formatPaise(balancePaise)}
                  </span>{' '}
                  का बकाया है।
                </>
              ) : (
                <>
                  <span className="font-black text-rose-600 font-heading">
                    {formatPaise(balancePaise)}
                  </span>{' '}
                  with your current milkman (
                  <span className="font-bold text-slate-900">
                    {currentMilkman?.businessName || 'Current Milkman'}
                  </span>
                  ).
                </>
              )}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 font-medium">
              {isHi
                ? 'दूसरे डेयरी प्रदाता पर जाने से पहले पिछले महीने और चालू महीने के सभी बकाए चुकाने होंगे।'
                : 'All previous month & running dues must be settled before you can switch to another dairy provider.'}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 text-left font-medium">
            💡 {isHi ? 'बिलिंग पेज पर भुगतान पूरा होने के बाद, आप यहां वापस आकर तुरंत नया दूधवाला चुन सकते हैं।' : 'Once payment is completed on the billing page, you can return here and immediately choose a new milkman.'}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full sm:w-auto order-2 sm:order-1 text-slate-500"
            >
              {isHi ? 'बंद करें' : 'Close'}
            </Button>
            <Link href="/billing" className="w-full sm:flex-1 order-1 sm:order-2">
              <Button type="button" className="w-full font-bold">
                {isHi ? `बिल भरें (${formatPaise(balancePaise)}) →` : `Pay Bill (${formatPaise(balancePaise)}) →`}
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
      title={
        step === 'plans'
          ? (isHi ? `प्लान चुनें • ${selectedMilkman?.businessName}` : `Select Plans • ${selectedMilkman?.businessName}`)
          : (isHi ? 'नया डेयरी प्रदाता चुनें' : 'Choose New Dairy Provider')
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2.5">
          {step === 'plans' ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setStep('search')}>
              {isHi ? '← वापस सूची पर जाएं' : '← Back to Milkmen'}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              {isHi ? 'रद्द करें' : 'Cancel'}
            </Button>
          )}

          {step === 'plans' ? (
            <Button
              type="button"
              onClick={handleConfirmSwitch}
              loading={pending}
              className="font-bold whitespace-nowrap"
            >
              {isHi
                ? `बदलने की पुष्टि करें (${selectedPlanIds.length} प्लान)`
                : `Confirm Switch (${selectedPlanIds.length} ${selectedPlanIds.length === 1 ? 'Plan' : 'Plans'})`}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!selectedMilkman}
              onClick={() => setStep('plans')}
              className="font-bold"
            >
              {isHi ? 'आगे: प्लान चुनें →' : 'Next: Select Plans →'}
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
              {isHi ? 'डिलीवरी पिनकोड' : 'Delivery Pincode'}
            </label>
            <div className="flex gap-2">
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder={isHi ? '6-अंकों का पिनकोड' : '6-digit pincode'}
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
                {isHi ? 'खोजें' : 'Search'}
              </Button>
            </div>
          </div>

          {/* List of Available Milkmen */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              {isHi ? `उपलब्ध डेयरी प्रदाता (${milkmen.length})` : `Available Dairy Providers (${milkmen.length})`}
            </label>

            {loadingSearch ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {isHi ? 'प्रदाताओं की खोज की जा रही है...' : 'Searching providers...'}
              </div>
            ) : milkmen.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                {isHi ? (
                  <>पिनकोड <span className="font-bold text-slate-800">{pincode}</span> के लिए कोई अन्य सत्यापित दूधवाला नहीं मिला।</>
                ) : (
                  <>No other verified milkmen found for pincode <span className="font-bold text-slate-800">{pincode}</span>.</>
                )}
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
                            {isHi ? 'सत्यापित' : 'Verified'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{m.name} • {m.phone}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {m.plans?.length || 0} {isHi ? 'सक्रिय दूध प्लान उपलब्ध' : 'active milk plans available'}
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
            {isHi ? (
              <>
                <span className="font-bold text-slate-900">{selectedMilkman?.businessName}</span> से दैनिक डिलीवरी के लिए अधिकतम <span className="font-bold">2 दूध प्लान</span> चुनें।
              </>
            ) : (
              <>
                Select up to <span className="font-bold">2 milk plans</span> to receive daily from{' '}
                <span className="font-bold text-slate-900">{selectedMilkman?.businessName}</span>.
              </>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(selectedMilkman?.plans || []).length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                {isHi
                  ? 'इस डेयरी के पास वर्तमान में कोई सार्वजनिक दूध प्लान सूचीबद्ध नहीं है। आप फिर भी बदल सकते हैं और सीधे प्लान का अनुरोध कर सकते हैं।'
                  : 'This dairy has no public milk plans currently listed. You can still switch and request plans directly.'}
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
                      {/* Product Name stays in English */}
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
