'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { cn, Card, CardBody, CardHeader, Notice, Badge } from '@/components/ui/index.jsx';
import { Button, Input } from '@/components/ui/interactive.jsx';
import { startTrial, submitSaasPayment, quickVerifyMyDairy } from '@/actions/milkman.actions.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import { CheckIcon, CopyIcon, PhoneIcon, UsersIcon, PaymentsIcon } from '@/components/ui/Icons.jsx';
import { useT } from '@/i18n/provider.jsx';

export function QuickVerifyDairy() {
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  return (
    <Button
      variant="outline"
      size="md"
      className="w-full font-semibold"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await quickVerifyMyDairy();
          if (result.ok) {
            toast.success(isHi ? 'आपकी डेयरी अब सत्यापित हो गई है! आप मुफ़्त परीक्षण शुरू कर सकते हैं।' : 'Your dairy is now verified! You can start your free trial.');
            window.location.reload();
          } else {
            toast.error(result.message ?? (isHi ? 'डेयरी सत्यापित नहीं हो सकी।' : 'Could not verify dairy.'));
          }
        })
      }
    >
      {isHi ? 'मेरी डेयरी तुरंत सत्यापित करें (एक-क्लिक सक्रियण)' : 'Instant Verify My Dairy (One-Click Activation)'}
    </Button>
  );
}

export function StartTrial() {
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  return (
    <Button
      size="lg"
      className="w-full"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startTrial();
          if (result.ok) {
            toast.success(isHi ? 'ट्रायल शुरू हो गया है। आपका पैनल खुल गया है।' : 'Trial started. Your panel is open.');
            window.location.href = '/milkman';
          } else {
            toast.error(result.message ?? (isHi ? 'ट्रायल शुरू नहीं हो सका।' : 'Could not start the trial.'));
          }
        })
      }
    >
      {isHi ? 'मुफ़्त ट्रायल शुरू करें' : 'Start my free trial'}
    </Button>
  );
}

/**
 * Pay for a plan.
 *
 * Money moves offline to the platform's UPI, and the milkman records the
 * reference here. An administrator checks it against the bank statement before
 * the panel opens — there is no automatic reconciliation.
 *
 * Changing plans: when `current` is a live plan, its card is marked and cannot
 * be picked again, plans with fewer seats than `customerCount` are greyed
 * out, and the copy says the new plan starts the day it is verified. While
 * a change is in the queue (`pendingChange`) the form is replaced by a note.
 *
 * @param {object} props
 * @param {Array}  props.plans
 * @param {object} props.settings   platform UPI / support details
 * @param {{planId: string, planName: string, status: string}|null} [props.current]
 * @param {number} [props.customerCount]
 * @param {{planName: string, createdAt: string}|null} [props.pendingChange]
 */
export function SubmitSaasPayment({ plans, settings, current = null, customerCount = 0, pendingChange = null }) {
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  const onPlan = current?.status === 'ACTIVE' ? current.planId : null;
  const selectable = (p) => p.id !== onPlan && p.maxCustomers >= customerCount;
  const [planId, setPlanId] = useState(() => {
    // Default to the next plan up from the current one, else the first that fits.
    const bigger = plans.filter((p) => selectable(p) && (!current || p.maxCustomers > (current.customerLimit ?? 0)));
    return (bigger[0] ?? plans.find(selectable) ?? plans[0])?.id ?? '';
  });
  const [errors, setErrors] = useState({});

  const plan = plans.find((p) => p.id === planId);
  const changing = Boolean(current && (current.status === 'ACTIVE' || current.status === 'TRIAL'));

  if (plans.length === 0) {
    return (
      <Notice tone="caution" title={isHi ? 'कोई प्लान बिक्री पर नहीं है' : 'No plans on sale'}>
        {isHi
          ? 'कृपया सहायता से संपर्क करें — अभी कोई सदस्यता प्लान उपलब्ध नहीं है।'
          : 'Please contact support — there are no subscription plans available right now.'}
      </Notice>
    );
  }

  if (pendingChange) {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-caution-soft text-caution">
            <PaymentsIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-extrabold text-ink">
              {isHi
                ? `${pendingChange.planName} में बदलाव — सत्यापन की प्रतीक्षा में`
                : `Switching to ${pendingChange.planName} — awaiting verification`}
            </p>
            <p className="mt-1 text-sm font-medium text-ink-muted">
              {isHi
                ? `हम आपके भुगतान की जांच कर रहे हैं। ${current?.planName ? `पुष्टि होने तक आपका ${current.planName} प्लान सक्रिय रहेगा;` : 'आपका पैनल खुलेगा'} ${pendingChange.planName} सत्यापन वाले दिन से शुरू होगा।`
                : `We are checking your payment. ${current?.planName ? `Your ${current.planName} plan stays open until it is confirmed;` : 'Your panel opens'} ${pendingChange.planName} then starts that day.`}
            </p>
            {pendingChange.paymentReference ? (
              <p className="mt-1.5 text-xs font-semibold text-ink-subtle">
                {isHi ? 'रेफरेंस नंबर' : 'Reference'}{' '}
                <span className="font-numeric text-ink">{pendingChange.paymentReference}</span>
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Pick a plan ────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={changing ? (isHi ? 'प्लान बदलें' : 'Change plan') : (isHi ? 'प्लान चुनें' : 'Choose a plan')}
          description={
            changing
              ? isHi
                ? `आप अभी ${current.planName ?? 'मुफ़्त ट्रायल'} पर हैं। दूसरा चुनें और भुगतान करें; भुगतान सत्यापित होने के दिन से नया प्लान लागू होगा।`
                : `You are on ${current.planName ?? 'the free trial'}. Pick another and pay for it; it takes over the day we verify the payment.`
              : isHi
                ? 'प्रत्येक प्लान में पूरा पैनल मिलता है; वे केवल ग्राहकों की संख्या क्षमता में भिन्न हैं।'
                : 'Every plan opens the full panel; they differ in how many customers you can serve.'
          }
        />
        <CardBody className="pt-4">
          <PlanPicker
            plans={plans}
            value={planId}
            onChange={setPlanId}
            onPlan={onPlan}
            customerCount={customerCount}
            isHi={isHi}
          />
        </CardBody>
      </Card>

      {/* ── 2. Pay, then record the reference ─────────────────────────── */}
      <Card>
        <CardHeader
          title={isHi ? 'भुगतान करें और सक्रिय करें' : 'Pay and activate'}
          description={
            isHi
              ? 'UPI द्वारा राशि भेजें, फिर अपने बैंकिंग ऐप से रेफरेंस नंबर / UTR दर्ज करें।'
              : 'Send the amount by UPI, then enter the reference from your banking app.'
          }
        />
        <CardBody className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="space-y-3">
              {/* The amount, large — the one number to type into the UPI app. */}
              <div className="rounded-2xl bg-hero-blue p-4 text-white shadow-hero">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/80">
                  {isHi ? 'भेजने के लिए राशि' : 'Amount to send'}
                </p>
                <p className="stat-number mt-0.5 text-3xl leading-none">
                  {plan ? formatPaise(toPaise(plan.monthlyPrice), { whole: true }) : '—'}
                </p>
                {plan ? (
                  <p className="mt-1.5 text-xs font-semibold text-white/85">
                    {plan.name} · {plan.durationDays ?? 30} {isHi ? 'दिन' : 'days'} · {isHi ? `अधिकतम ${plan.maxCustomers} ग्राहक` : `up to ${plan.maxCustomers} customers`}
                  </p>
                ) : null}
                {changing && plan ? (
                  <p className="mt-1 text-[11px] font-medium text-white/75">
                    {isHi
                      ? `सत्यापित होने के दिन से शुरू होता है। ${current.planName ?? 'ट्रायल'} के बचे हुए दिन आगे नहीं जुड़ते।`
                      : `Starts the day it is verified. Days left on ${current.planName ?? 'the trial'} are not carried over.`}
                  </p>
                ) : null}
              </div>

              <CopyField
                label={isHi ? 'भुगतान करें (UPI ID)' : 'Pay to (UPI ID)'}
                value={settings.upiId}
                placeholder={isHi ? 'अभी कॉन्फ़िगर नहीं है' : 'Not configured yet'}
                isHi={isHi}
              />

              {settings.bankDetails ? (
                <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">
                    {isHi ? 'बैंक ट्रांसफर' : 'Bank transfer'}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-xs font-medium text-ink">{settings.bankDetails}</p>
                </div>
              ) : null}

              {settings.supportPhone ? (
                <a
                  href={`tel:${settings.supportPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                  {isHi ? `सहायता चाहिए? कॉल करें ${settings.supportPhone}` : `Need help? Call ${settings.supportPhone}`}
                </a>
              ) : null}
            </div>

            {settings.qrCodeUrl ? (
              <figure className="mx-auto w-fit rounded-2xl border border-border bg-surface p-2 shadow-card">
                <img
                  src={settings.qrCodeUrl}
                  alt="UPI QR code for DairyDrop"
                  className="h-44 w-44 rounded-xl bg-white object-contain"
                />
                <figcaption className="mt-1.5 text-center text-[11px] font-semibold text-ink-subtle">
                  {isHi ? 'भुगतान के लिए स्कैन करें' : 'Scan to pay'}
                </figcaption>
              </figure>
            ) : null}
          </div>

          <form
            className="space-y-4 border-t border-border pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(async () => {
                const result = await submitSaasPayment({
                  planId,
                  reference: data.get('reference'),
                });
                if (result.ok) {
                  toast.success(isHi ? 'सबमिट हो गया। हम जल्द पुष्टि करेंगे।' : 'Submitted. We will confirm shortly.');
                  window.location.reload();
                } else {
                  setErrors(result.fieldErrors ?? {});
                  toast.error(result.message ?? (isHi ? 'सबमिट नहीं हो सका।' : 'Could not submit that.'));
                }
              });
            }}
          >
            <Input
              name="reference"
              label={isHi ? 'लेनदेन संदर्भ / UTR नंबर' : 'Transaction reference / UTR'}
              inputMode="numeric"
              autoComplete="off"
              placeholder={isHi ? '12-अंकों का UTR' : '12-digit UTR'}
              hint={
                isHi
                  ? 'भुगतान सफल होने के बाद अपने UPI या बैंकिंग ऐप से दर्ज करें।'
                  : 'From your UPI or banking app, once the payment shows as successful.'
              }
              error={errors.reference}
              required
            />

            <Button type="submit" size="lg" className="w-full" loading={pending}>
              {pending ? null : <PaymentsIcon className="h-5 w-5" />}
              {isHi ? 'सत्यापन के लिए सबमिट करें' : 'Submit for verification'}
            </Button>

            <p className="text-xs font-medium text-ink-subtle">
              {isHi
                ? 'केवल ऊपर दिखाई गई UPI ID पर पैसे भेजें। हम कभी भी फोन पर पैसे नहीं मांगेंगे।'
                : 'Only send money to the UPI ID shown above. We will never ask for it by phone.'}
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Plan cards that behave as radio buttons.
 */
function PlanPicker({ plans, value, onChange, onPlan = null, customerCount = 0, isHi = false }) {
  const biggest = plans.reduce((max, p) => (p.maxCustomers > (max?.maxCustomers ?? -1) ? p : max), null);

  return (
    <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((p) => {
        const selected = p.id === value;
        const isCurrent = p.id === onPlan;
        const tooSmall = p.maxCustomers < customerCount;
        const disabled = isCurrent || tooSmall;
        const features = Array.isArray(p.features) ? p.features : [];
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={cn(
              'tap relative flex flex-col rounded-2xl border p-4 text-left transition-all',
              selected
                ? 'border-brand bg-brand-soft/60 shadow-card-hover ring-2 ring-brand/20'
                : disabled
                  ? 'cursor-not-allowed border-border bg-surface-muted/50 opacity-80'
                  : 'border-border bg-surface hover:border-brand/40 hover:shadow-card',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-heading text-base font-extrabold tracking-tight text-ink">{p.name}</p>
                {p.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs font-medium text-ink-muted">{p.description}</p>
                ) : null}
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  selected ? 'border-brand bg-brand text-brand-ink' : 'border-border bg-surface',
                )}
              >
                {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
              </span>
            </div>

            <p className="mt-3">
              <span className="stat-number text-2xl leading-none text-ink">
                {formatPaise(toPaise(p.monthlyPrice), { whole: true })}
              </span>
              <span className="ml-1 text-xs font-bold text-ink-muted">
                / {p.durationDays === 30 || !p.durationDays ? (isHi ? 'महीना' : 'month') : isHi ? `${p.durationDays} दिन` : `${p.durationDays} days`}
              </span>
            </p>

            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
              <UsersIcon className="h-4 w-4 text-brand" />
              {isHi ? `अधिकतम ${p.maxCustomers} ग्राहक` : `Up to ${p.maxCustomers} customers`}
            </p>

            {features.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-xs font-medium text-ink-muted">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {isCurrent ? <Badge tone="positive" dot>{isHi ? 'आपका प्लान' : 'Your plan'}</Badge> : null}
              {tooSmall ? (
                <Badge tone="critical">
                  {isHi ? `आपके ${customerCount} ग्राहकों के लिए बहुत छोटा` : `Too small for your ${customerCount} customers`}
                </Badge>
              ) : null}
              {!disabled && biggest && p.id === biggest.id && plans.length > 1 ? (
                <Badge tone="brand">{isHi ? 'सबसे अधिक क्षमता' : 'Most room'}</Badge>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** A value with a copy button — for the UPI ID, which nobody wants to retype. */
function CopyField({ label, value, placeholder, isHi = false }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(isHi ? 'UPI ID कॉपी हो गई।' : 'UPI ID copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isHi ? 'कॉपी नहीं हो सका — चयन करने के लिए देर तक दबाएं।' : 'Could not copy — long-press to select it instead.');
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">{label}</p>
        <p className={cn('truncate font-numeric text-sm font-extrabold', value ? 'select-all text-ink' : 'text-ink-subtle')}>
          {value ?? placeholder}
        </p>
      </div>
      {value ? (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? (isHi ? 'कॉपी किया गया' : 'Copied') : `${isHi ? 'कॉपी करें' : 'Copy'} ${label}`}
          className={cn(
            'tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-colors',
            copied ? 'border-positive/30 bg-positive-soft text-positive' : 'border-border bg-surface text-brand hover:bg-brand-soft',
          )}
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}

