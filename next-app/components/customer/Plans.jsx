'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, Badge, Notice, cn } from '@/components/ui/index.jsx';
import { Button, Modal, Select, Textarea } from '@/components/ui/interactive.jsx';
import { MilkDropIcon, CheckIcon } from '@/components/ui/Icons.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import {
  subscribe,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  requestPlanChange,
  switchFromRetiredPlan,
} from '@/actions/customer.actions.js';
import { useT } from '@/i18n/provider.jsx';

/** A plan the customer already holds, with its lifecycle actions. */
export function SubscriptionCard({ subscription, availablePlans, pendingRequest, withdrawn }) {
  const [modal, setModal] = useState(null);
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  function run(action, payload, message) {
    startTransition(async () => {
      const result = await action(payload);
      if (result.ok) {
        toast.success(message);
        setModal(null);
      } else {
        toast.error(result.message ?? (isHi ? 'कुछ गड़बड़ हुई।' : 'Something went wrong.'));
      }
    });
  }

  const otherPlans = availablePlans.filter((plan) => plan.id !== subscription.planId);

  const freqLabel = isHi
    ? subscription.frequency === 'DAILY'
      ? 'दैनिक'
      : subscription.frequency === 'ALTERNATE'
      ? 'एक दिन छोड़कर'
      : subscription.frequency.replace('_', ' ').toLowerCase()
    : subscription.frequency.replace('_', ' ').toLowerCase();

  const slotLabel = isHi
    ? subscription.slot === 'MORNING'
      ? 'सुबह'
      : subscription.slot === 'EVENING'
      ? 'शाम'
      : subscription.slot.toLowerCase()
    : subscription.slot.toLowerCase();

  return (
    <>
      <div className="group relative overflow-hidden rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md">
        {/* Top Accent line */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1.5',
            subscription.status === 'ACTIVE'
              ? 'bg-emerald-500'
              : subscription.status === 'PAUSED'
                ? 'bg-amber-500'
                : 'bg-slate-300',
          )}
        />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <MilkDropIcon className="h-4 w-4" />
                </span>
                <h3 className="font-heading text-lg font-black tracking-tight text-slate-900">
                  {subscription.productName}
                </h3>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {Number(subscription.quantity)} {subscription.unit} · {freqLabel} · {slotLabel}
              </p>
              <DeliveryWindows source={subscription} className="mt-1" isHi={isHi} />
            </div>
            <StatusBadge status={subscription.status} locale={locale} />
          </div>

          <div className="flex items-baseline gap-2 rounded-2xl bg-slate-50/90 border border-slate-200/70 px-4 py-3">
            <span className="font-heading text-2xl font-black tnum text-slate-950">
              ₹{Number(subscription.unitPrice).toFixed(2)}
            </span>
            <span className="font-heading text-xs font-bold text-slate-500">
              {isHi ? `प्रति ${subscription.unit}` : `per ${subscription.unit}`}
            </span>
          </div>

          <RateNote subscription={subscription} plans={availablePlans} isHi={isHi} />

          {withdrawn ? (
            <Notice tone="info" title={isHi ? 'अब उपलब्ध नहीं' : 'No longer offered'}>
              {isHi
                ? 'आपकी डेयरी ने यह नया प्लान देना बंद कर दिया है। आपका प्लान जब तक आप चाहें चलता रहेगा।'
                : 'Your milkman has stopped offering this plan. Yours keeps running on these terms for as long as you want it.'}
            </Notice>
          ) : null}

          {pendingRequest ? (
            <Notice tone="caution" title={isHi ? 'बदलाव का अनुरोध भेजा गया' : 'Change requested'}>
              {isHi
                ? `${pendingRequest.requestedPlanName} पर बदलने के लिए दूधवाले की स्वीकृति की प्रतीक्षा है।`
                : `Waiting for your milkman to approve the move to ${pendingRequest.requestedPlanName}.`}
            </Notice>
          ) : null}

          {!pendingRequest && subscription.status === 'ACTIVE' ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {otherPlans.length > 0 ? (
                <button
                  type="button"
                  className="tap flex-1 rounded-2xl border border-blue-600 bg-white px-3.5 py-2.5 font-heading text-xs font-bold text-blue-700 hover:bg-blue-50 transition-all active:scale-[0.98]"
                  onClick={() => setModal('change')}
                >
                  {isHi ? 'प्लान बदलें' : 'Change Plan'}
                </button>
              ) : null}
              <button
                type="button"
                className="tap flex-1 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 font-heading text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all active:scale-[0.98]"
                disabled={pending}
                onClick={() => run(pauseSubscription, { rootId: subscription.rootId }, isHi ? 'डिलीवरी रोकी गई।' : 'Deliveries paused.')}
              >
                {isHi ? 'रोकें' : 'Pause'}
              </button>
              <button
                type="button"
                className="tap rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-heading text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-[0.98]"
                onClick={() => setModal('cancel')}
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          ) : null}

          {subscription.status === 'PAUSED' ? (
            <button
              type="button"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-heading text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98]"
              disabled={pending}
              onClick={() => run(resumeSubscription, { rootId: subscription.rootId }, isHi ? 'डिलीवरी पुनः चालू की गई!' : 'Deliveries resumed!')}
            >
              <span>{isHi ? '▶ डिलीवरी पुनः चालू करें' : '▶ Resume Deliveries'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Request a plan change ───────────────────────────────────── */}
      <Modal
        open={modal === 'change'}
        onClose={() => setModal(null)}
        title={isHi ? 'प्लान बदलें' : 'Change plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>{isHi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button form="change-form" type="submit" loading={pending}>{isHi ? 'अनुरोध भेजें' : 'Send request'}</Button>
          </>
        }
      >
        <form
          id="change-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              requestPlanChange,
              {
                rootId: subscription.rootId,
                planId: data.get('planId'),
                note: data.get('note'),
              },
              isHi ? 'अनुरोध दूधवाले को भेज दिया गया।' : 'Request sent to your milkman.',
            );
          }}
        >
          <p className="text-sm text-ink-muted">
            {isHi
              ? 'आपका दूधवाला इस बदलाव की पुष्टि करेगा। यह कल से लागू होगा — इस महीने के बिल में डिलीवर हो चुके दिनों का आज का ही रेट रहेगा।'
              : "Your milkman approves the change. It takes effect from tomorrow — this month's bill keeps today's price for the days already delivered."}
          </p>

          <Select
            name="planId"
            label={isHi ? 'नया प्लान' : 'New plan'}
            options={otherPlans.map((plan) => ({
              value: plan.id,
              label: `${plan.name} · ${Number(plan.quantity)} ${plan.unit} · ${formatPaise(plan.quotedMonthlyPaise, { whole: true })}/mo`,
            }))}
          />

          <Textarea
            name="note"
            label={isHi ? 'आप प्लान क्यों बदल रहे हैं?' : 'Why are you changing?'}
            required
            maxLength={500}
            placeholder={isHi ? 'जैसे: घर पर सदस्य बढ़ गए हैं इसलिए अधिक दूध चाहिए।' : 'We need more milk now that my parents have moved in.'}
          />
        </form>
      </Modal>

      {/* ── Cancel ──────────────────────────────────────────────────── */}
      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title={isHi ? 'क्या यह प्लान रद्द करना चाहते हैं?' : 'Cancel this plan?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>{isHi ? 'चालू रखें' : 'Keep it'}</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => run(cancelSubscription, { rootId: subscription.rootId }, isHi ? 'प्लान रद्द हो गया।' : 'Plan cancelled.')}
            >
              {isHi ? 'प्लान रद्द करें' : 'Cancel plan'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {isHi
            ? 'डिलीवरी कल से बंद हो जाएगी। आज की डिलीवरी और इस महीने पहले डिलीवर हो चुका सामान सामान्य रूप से बिल किया जाएगा।'
            : "Deliveries stop from tomorrow. Today's delivery, and everything already delivered this month, is still billed as normal."}
        </p>
      </Modal>
    </>
  );
}

/** A plan on offer from the customer's milkman. */
export function PlanCard({ plan, alreadySubscribed, subscribedRate, blockedBy, maxPlansReached }) {
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  const slotName = isHi
    ? plan.slot === 'MORNING' ? 'सुबह' : plan.slot === 'EVENING' ? 'शाम' : plan.slot.toLowerCase()
    : plan.slot.toLowerCase();

  const freqName = isHi
    ? plan.frequency === 'DAILY' ? 'दैनिक' : plan.frequency === 'ALTERNATE' ? 'एक दिन छोड़कर' : plan.frequency.replace('_', ' ').toLowerCase()
    : plan.frequency.replace('_', ' ').toLowerCase();

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-2">
              <MilkDropIcon className="h-5 w-5" />
            </span>
            <h3 className="font-heading text-lg font-black tracking-tight text-slate-900 mt-1">
              {plan.name}
            </h3>
            <p className="text-xs font-semibold text-blue-600">{plan.productName}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 border border-blue-200/60">
            {slotName}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 rounded-2xl bg-slate-50 border border-slate-200/70 p-3">
          <span className="font-heading text-2xl font-black text-slate-950 tnum">
            {formatPaise(plan.quotedMonthlyPaise, { whole: true })}
          </span>
          <span className="font-heading text-xs font-bold text-slate-500">
            {isHi ? '/ अनुमानित मासिक' : '/ estimated mo.'}
          </span>
        </div>

        <ul className="space-y-1.5 text-xs font-medium text-slate-600">
          <li className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
            <span>
              <strong className="text-slate-900">{Number(plan.quantity)} {plan.unit}</strong>{' '}
              {isHi ? 'प्रति सुबह' : 'per morning'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
            <span>{freqName} {isHi ? 'डिलीवरी' : 'delivery'}</span>
          </li>
          <WindowItems source={plan} isHi={isHi} />
        </ul>

        <p className="text-[11px] font-medium text-slate-400">
          {isHi
            ? `पारदर्शी बिलिंग: ₹${Number(plan.unitPrice).toFixed(2)} प्रति ${plan.unit} जो वास्तव में मिले।`
            : `Transparent billing: ₹${Number(plan.unitPrice).toFixed(2)} per ${plan.unit} actually received.`}
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100">
        {alreadySubscribed ? (
          <div className="flex items-center justify-center gap-1.5 w-full text-center rounded-2xl bg-emerald-50 border border-emerald-200 py-3 font-heading text-xs font-extrabold text-emerald-800">
            <CheckIcon className="h-4 w-4" />
            <span>
              {subscribedRate && Number(subscribedRate) !== Number(plan.unitPrice)
                ? isHi
                  ? `सक्रिय · ₹${Number(subscribedRate).toFixed(2)} पर बिल`
                  : `Active · Billed at ₹${Number(subscribedRate).toFixed(2)}`
                : isHi ? 'वर्तमान में सब्सक्राइब किया हुआ' : 'Currently Subscribed'}
            </span>
          </div>
        ) : blockedBy?.switchFrom ? (
          <>
            <button
              type="button"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await switchFromRetiredPlan({
                    rootId: blockedBy.switchFrom,
                    planId: plan.id,
                  });
                  if (result.ok) {
                    toast.success(isHi ? `${plan.name} पर स्विच हो गया। यह कल से शुरू होगा।` : `Switched to ${plan.name}. It starts tomorrow.`);
                  } else {
                    toast.error(result.message ?? (isHi ? 'उस प्लान पर स्विच नहीं हो सका।' : 'Could not switch to that plan.'));
                  }
                })
              }
            >
              <span>{isHi ? 'इस प्लान पर बदलें' : 'Switch to this Plan'}</span>
              <span>→</span>
            </button>
            <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
              {isHi
                ? 'आपका पुराना प्लान बंद हो चुका है। कल से आसानी से नए प्लान पर स्विच करें।'
                : 'Your old plan is retired. Switch seamlessly starting tomorrow.'}
            </p>
          </>
        ) : blockedBy ? (
          <>
            <button className="tap flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-heading text-xs font-bold text-slate-400 cursor-not-allowed" disabled>
              {isHi ? 'इस समय पर पहले से सक्रिय' : 'Already on this slot'}
            </button>
            <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
              {isHi
                ? `आपको पहले से ही ${blockedBy.times} में ${blockedBy.productName} मिल रहा है।`
                : `You already receive ${blockedBy.productName} in the ${blockedBy.times}.`}
            </p>
          </>
        ) : maxPlansReached ? (
          <>
            <button className="tap flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-heading text-xs font-bold text-slate-400 cursor-not-allowed" disabled>
              {isHi ? 'अधिकतम 2 प्लान सक्रिय' : 'Max 2 Plans Active'}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-amber-700 font-medium">
              {isHi
                ? 'सीमा पूरी। सब्सक्राइब करने के लिए मौजूदा प्लान बदलें या रद्द करें।'
                : 'Limit reached. Change or cancel an existing plan to subscribe.'}
            </p>
          </>
        ) : (
          <button
            type="button"
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await subscribe({ planId: plan.id });
                if (result.ok) {
                  if (result.data?.requiresApproval) {
                    toast.success(isHi ? `${plan.name} के लिए अनुरोध भेजा गया! दूधवाले की स्वीकृति की प्रतीक्षा है।` : `Subscribed to ${plan.name}! Waiting for milkman approval.`);
                    window.location.href = '/pending';
                  } else {
                    toast.success(isHi ? `${plan.name} सब्सक्राइब हो गया। डिलीवरी कल से शुरू होगी!` : `Subscribed to ${plan.name}. Deliveries start tomorrow!`);
                  }
                } else {
                  toast.error(result.message ?? (isHi ? 'सब्सक्राइब नहीं हो सका।' : 'Could not subscribe.'));
                }
              })
            }
          >
            <span>{isHi ? 'अभी सब्सक्राइब करें' : 'Subscribe Now'}</span>
            <span>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** The delivery hours held on a plan or a subscription. */
function DeliveryWindows({ source, className, isHi }) {
  const morning = formatWindow(source.morningStart, source.morningEnd);
  const evening = formatWindow(source.eveningStart, source.eveningEnd);
  if (!morning && !evening) return null;

  const mLabel = isHi ? 'सुबह' : 'Morning';
  const eLabel = isHi ? 'शाम' : 'Evening';

  return (
    <p className={`text-sm text-ink ${className ?? ''}`}>
      {[morning && `${mLabel} ${morning}`, evening && `${eLabel} ${evening}`]
        .filter(Boolean)
        .join(' · ')}
    </p>
  );
}

/** The same thing as list items, for the plan card's feature list. */
function WindowItems({ source, isHi }) {
  const morning = formatWindow(source.morningStart, source.morningEnd);
  const evening = formatWindow(source.eveningStart, source.eveningEnd);
  const mLabel = isHi ? 'सुबह' : 'Morning';
  const eLabel = isHi ? 'शाम' : 'Evening';

  return (
    <>
      {morning ? <li className="text-ink">{mLabel} {morning}</li> : null}
      {evening ? <li className="text-ink">{eLabel} {evening}</li> : null}
    </>
  );
}

/** Says so when the rate you agreed to differs from the plan's rate today. */
function RateNote({ subscription, plans, isHi }) {
  const plan = (plans ?? []).find((p) => p.id === subscription.planId);
  if (!plan?.unitPrice) return null;

  const agreed = Number(subscription.unitPrice);
  const current = Number(plan.unitPrice);
  if (!Number.isFinite(agreed) || !Number.isFinite(current) || agreed === current) return null;

  return (
    <p className="text-xs text-ink-muted">
      {isHi
        ? `यह वह दर है जिस पर आपने साइन अप किया था। ${plan.name} अब ₹${current.toFixed(2)} प्रति ${subscription.unit} है — आपकी कीमत तभी बदलेगी जब आप इस पर स्विच करेंगे।`
        : `This is the rate you signed up at. ${plan.name} is now ₹${current.toFixed(2)} per ${subscription.unit} — your price only changes if you move to it.`}
    </p>
  );
}
