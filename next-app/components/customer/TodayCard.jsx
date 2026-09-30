'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, cn } from '@/components/ui/index.jsx';
import { Button, Modal, QuantityStepper, Textarea } from '@/components/ui/interactive.jsx';
import { MilkDropIcon, EditIcon, VacationIcon, UndoIcon } from '@/components/ui/Icons.jsx';
import { skipDay, resumeDay, adjustQuantity } from '@/actions/customer.actions.js';
import { formatWindow, formatDateShort } from '@/domain/dates.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * One plan's delivery for today or tomorrow.
 *
 * Dual Language Support (English / Hindi).
 * Context-aware: seamlessly switches between Today's and Tomorrow's delivery
 * with strict 10:00 PM previous-night cutoff enforcement.
 */
/**
 * @param {object} props
 * @param {object} [props.successor]  the plan version that takes over from
 *   this delivery's terms, when a change is waiting to start. The card is
 *   then drawn greyed, as the plan on its way out; today's delivery on it is
 *   still real and still actionable.
 */
export function TodayCard({ delivery, isTomorrow = false, cutoffPassed = false, successor = null }) {
  const router = useRouter();
  const [modal, setModal] = useState(null);
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  const quantity = Number(delivery.adjustedQuantity ?? delivery.plannedQuantity);
  const planned = Number(delivery.plannedQuantity);
  const adjusted = delivery.adjustedQuantity != null && quantity !== planned;
  const actionable = delivery.status === 'PENDING' && !cutoffPassed;

  function run(action, payload, successMessage) {
    startTransition(async () => {
      const result = await action(payload);
      if (result.ok) {
        toast.success(successMessage);
        setModal(null);
        router.refresh();
      } else {
        toast.error(result.message ?? (isHi ? 'कुछ गड़बड़ हुई।' : 'Something went wrong.'));
      }
    });
  }

  return (
    <>
      <div
        className={cn(
          'group relative h-full overflow-hidden rounded-3xl border-2 p-4 pt-5 sm:p-5 sm:pt-6 shadow-sm transition-all',
          successor
            ? 'border-slate-200 bg-slate-50 grayscale opacity-70 hover:opacity-90'
            : 'border-slate-200/90 bg-white hover:border-blue-400 hover:shadow-md',
        )}
      >
        {/* Top accent line based on status */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1.5',
            delivery.status === 'DELIVERED'
              ? 'bg-emerald-500'
              : delivery.status === 'SKIPPED'
                ? 'bg-slate-300'
                : 'bg-blue-600',
          )}
        />

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <MilkDropIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-base font-black leading-tight tracking-tight text-slate-900 sm:text-lg">
                {delivery.productName}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                <SlotLine delivery={delivery} isHi={isHi} />
              </p>
              <EndingNote delivery={delivery} successor={successor} isHi={isHi} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <p className="leading-none">
                <span className="font-heading text-3xl font-black text-slate-950 tnum">
                  {delivery.status === 'DELIVERED' ? Number(delivery.deliveredQuantity) : quantity}
                </span>
                <span className="ml-1 font-heading text-sm font-bold text-slate-600">{delivery.unit}</span>
              </p>
              <StatusBadge status={delivery.status} locale={locale} />
            </div>
          </div>

          {adjusted ? (
            <p className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
              {isHi
                ? `${isTomorrow ? 'कल' : 'आज'} के लिए बदला गया (सामान्यतः ${planned} ${delivery.unit})`
                : `Changed for ${isTomorrow ? 'tomorrow' : 'today'} (usually ${planned} ${delivery.unit})`}
            </p>
          ) : null}

          {delivery.status === 'SKIPPED' ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-600">
              {isHi
                ? `छुट्टी${delivery.note ? ` — ${delivery.note}` : ''}। कोई शुल्क नहीं लिया जाएगा।`
                : `Skipped${delivery.note ? ` — ${delivery.note}` : ''}. You will not be charged.`}
            </p>
          ) : null}

          {/* Cutoff notice if modifications are closed */}
          {delivery.status === 'PENDING' && cutoffPassed ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800">
              {isHi
                ? '10:00 PM का कटऑफ समय निकल चुका है। कल सुबह के लिए बदलाव बंद हैं।'
                : '10:00 PM cutoff has passed. Modifications for tomorrow morning are locked.'}
            </div>
          ) : null}

          {actionable ? (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white px-4 py-3 font-heading text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition-all active:scale-[0.98]"
                onClick={() => setModal('quantity')}
              >
                <EditIcon className="h-4 w-4" />
                <span>{isHi ? (isTomorrow ? 'कल की मात्रा बदलें' : 'मात्रा बदलें') : 'Change Quantity'}</span>
              </button>
              <button
                type="button"
                className="tap flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-heading text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-[0.98]"
                onClick={() => setModal('skip')}
              >
                <VacationIcon className="h-4 w-4" />
                <span>{isHi ? (isTomorrow ? 'कल छोड़ें' : 'आज छोड़ें') : (isTomorrow ? 'Skip Tomorrow' : 'Skip Today')}</span>
              </button>
            </div>
          ) : null}

          {delivery.status === 'SKIPPED' && !cutoffPassed ? (
            <button
              type="button"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-blue-50 px-4 py-3 font-heading text-xs font-bold text-blue-700 transition-all hover:bg-blue-100"
              disabled={pending}
              onClick={() =>
                run(
                  resumeDay,
                  { deliveryId: delivery.id },
                  isHi
                    ? `${isTomorrow ? 'कल' : 'आज'} की डिलीवरी पुनः चालू की गई।`
                    : `${isTomorrow ? 'Tomorrow' : 'Today'} delivery resumed.`,
                )
              }
            >
              <UndoIcon className="h-4 w-4" />
              <span>{isHi ? 'छुट्टी रद्द करें (Resume)' : 'Undo Skip'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Change quantity ─────────────────────────────────────────── */}
      <Modal
        open={modal === 'quantity'}
        onClose={() => setModal(null)}
        title={isHi ? 'आज कितनी मात्रा चाहिए?' : 'How much today?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              {isHi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button
              form="quantity-form"
              type="submit"
              loading={pending}
            >
              {isHi ? 'पुष्टि करें' : 'Confirm'}
            </Button>
          </>
        }
      >
        <form
          id="quantity-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              adjustQuantity,
              {
                deliveryId: delivery.id,
                quantity: data.get('quantity'),
                note: data.get('note') || undefined,
              },
              isHi
                ? 'मात्रा बदलाव का अनुरोध आपके दूधवाले को भेज दिया गया है।'
                : 'Quantity change request sent to your milkman for approval.',
            );
          }}
          className="space-y-4"
        >
          <p className="text-sm text-ink-muted">
            {isHi
              ? `यह केवल आज के लिए बदलेगा। आपका प्लान प्रतिदिन ${planned} ${delivery.unit} रहेगा।`
              : `This changes today only. Your plan stays at ${planned} ${delivery.unit} a day.`}
          </p>
          <div className="flex justify-center py-2">
            <QuantityStepper name="quantity" defaultValue={quantity} unit={delivery.unit} />
          </div>
          <Textarea
            name="note"
            label={isHi ? 'दूधवाले के लिए संदेश (वैकल्पिक)' : 'Note for your milkman (optional)'}
            placeholder={isHi ? 'जैसे: मेहमान आ रहे हैं, 1 लीटर अतिरिक्त चाहिए' : 'e.g. Guests arriving today'}
            maxLength={300}
          />
        </form>
      </Modal>

      {/* ── Skip ────────────────────────────────────────────────────── */}
      <Modal
        open={modal === 'skip'}
        onClose={() => setModal(null)}
        title={isHi ? 'आज की डिलीवरी छोड़ें?' : "Skip today's delivery?"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              {isHi ? 'चालू रखें' : 'Keep it'}
            </Button>
            <Button form="skip-form" type="submit" variant="danger" loading={pending}>
              {isHi ? 'आज छोड़ें' : 'Skip today'}
            </Button>
          </>
        }
      >
        <form
          id="skip-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              skipDay,
              { deliveryId: delivery.id, note: data.get('note') || undefined },
              isHi ? 'आज की डिलीवरी छोड़ दी गई है।' : 'Today has been skipped.',
            );
          }}
          className="space-y-4"
        >
          <p className="text-sm text-ink-muted">
            {isHi
              ? 'आज के लिए कोई शुल्क नहीं लिया जाएगा। आपके दूध विक्रेता को सूचित कर दिया जाएगा।'
              : 'You will not be charged for today. Your milkman will be told.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {(isHi
              ? ['शहर से बाहर हैं', 'घर में पर्याप्त है', 'यात्रा पर हैं']
              : ['Out of town', 'Enough at home', 'Travelling']
            ).map((reason) => (
              <label key={reason} className="cursor-pointer">
                <input type="radio" name="note" value={reason} className="peer sr-only" />
                <span className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand">
                  {reason}
                </span>
              </label>
            ))}
          </div>
        </form>
      </Modal>
    </>
  );
}

/** 'Morning 6:00 – 7:30 am', or just 'Morning' when no window is set. */
function SlotLine({ delivery, isHi }) {
  const morning = formatWindow(delivery.morningStart, delivery.morningEnd);
  const evening = formatWindow(delivery.eveningStart, delivery.eveningEnd);

  const mLabel = isHi ? 'सुबह' : 'Morning';
  const eLabel = isHi ? 'शाम' : 'Evening';

  if (delivery.slot === 'MORNING') return <>{mLabel}{morning ? ` · ${morning}` : ''}</>;
  if (delivery.slot === 'EVENING') return <>{eLabel}{evening ? ` · ${evening}` : ''}</>;

  // Both slots: show each window on its own, since they are different hours.
  if (!morning && !evening) return <>{isHi ? 'सुबह और शाम' : 'Morning & evening'}</>;
  return (
    <>
      {morning ? `${mLabel} · ${morning}` : mLabel}
      {' · '}
      {evening ? `${eLabel} · ${evening}` : eLabel}
    </>
  );
}

/**
 * A short line explaining that these terms are ending, or that the plan behind
 * them has been withdrawn.
 */
function EndingNote({ delivery, successor, isHi }) {
  if (successor) {
    const when = formatDateShort(successor.effectiveFrom);
    return (
      <p className="mt-1 text-xs font-bold text-slate-600">
        {isHi ? `पुराना प्लान — ${when} से नया प्लान` : `Old plan — ends before ${when}`}
      </p>
    );
  }

  if (delivery.termsEndOn) {
    return (
      <p className="mt-1 text-xs font-medium text-caution">
        {isHi ? 'पुराने प्लान पर — नया कल से शुरू होगा।' : 'On your old plan — the new one starts tomorrow.'}
      </p>
    );
  }

  if (delivery.planRetired) {
    return (
      <p className="mt-1 text-xs text-ink-muted">
        {isHi
          ? 'दूध विक्रेता ने यह प्लान बंद कर दिया है। आपका प्लान चलता रहेगा।'
          : 'Your milkman no longer offers this plan. Yours keeps running.'}
      </p>
    );
  }

  return null;
}

/**
 * The plan that takes over, shown beside the greyed card it replaces.
 *
 * Nothing here is stored or scheduled separately: it is the subscription's
 * next version, already in the database with its start date. On that date the
 * old version has ended, today's delivery comes from this one, and the page
 * simply stops drawing the pair — no job flips anything over.
 */
export function UpcomingPlanCard({ successor, isTomorrowStart }) {
  const { locale } = useT();
  const isHi = locale === 'hi';
  const when = formatDateShort(successor.effectiveFrom);
  const price = Number(successor.unitPrice ?? 0);

  return (
    <div className="relative h-full overflow-hidden rounded-3xl border-2 border-blue-400 bg-white p-5 sm:p-6 shadow-md">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <MilkDropIcon className="h-4 w-4" />
              </span>
              <h3 className="font-heading text-lg font-black tracking-tight text-slate-900">{successor.productName}</h3>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <SlotLine delivery={successor} isHi={isHi} />
            </p>
            <p className="mt-1 text-xs font-bold text-blue-700">
              {isHi
                ? `${isTomorrowStart ? 'कल' : when} से शुरू होगा`
                : `Starts ${isTomorrowStart ? 'tomorrow' : when}`}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-blue-700">
            {isHi ? 'नया प्लान' : 'New plan'}
          </span>
        </div>

        <div className="flex items-baseline gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
          <span className="font-heading text-3xl font-black text-slate-950 tnum">{Number(successor.quantity)}</span>
          <span className="font-heading text-sm font-bold text-slate-600">{successor.unit}</span>
          {price > 0 ? (
            <span className="ml-auto text-xs font-bold text-slate-500 tnum">
              ₹{price % 1 === 0 ? price : price.toFixed(2)}/{successor.unit}
            </span>
          ) : null}
        </div>

        <p className="text-xs font-medium text-slate-500">
          {isHi
            ? 'यह अपने आप सक्रिय हो जाएगा — आपको कुछ करने की ज़रूरत नहीं।'
            : 'This takes over automatically — nothing for you to do.'}
        </p>
      </div>
    </div>
  );
}
