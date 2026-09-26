'use client';

import { useState, useTransition, useOptimistic, useMemo } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/provider.jsx';

import { cn, StatusBadge, Badge } from '@/components/ui/index.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import { Button, Modal, QuantityStepper, Textarea, Select } from '@/components/ui/interactive.jsx';
import {
  CheckIcon,
  PhoneIcon,
  ClockIcon,
  MapPinIcon,
  SunIcon,
  MoonIcon,
  CartIcon,
  UndoIcon,
  CalendarIcon,
  PackageIcon,
  NoteIcon,
  CloseIcon,
  TruckIcon,
  PencilIcon,
} from '@/components/ui/Icons.jsx';
import { markDelivery, declareDayOff } from '@/actions/milkman.actions.js';
import { HolidayManagerModal } from './HolidayManagerModal.jsx';
import { MilkmanFilterBar } from './MilkmanFilterBar.jsx';

/**
 * One stop on the round.
 *
 * Status changes are optimistic — the pill flips immediately and rolls back if
 * the server rejects it. On a patchy connection in a stairwell that is the
 * difference between a usable app and an unusable one.
 */
/**
 * How a stop's slot reads on the card.
 *
 * `BOTH` only appears on rows written before morning and evening were split
 * into separate deliveries; it is labelled plainly rather than hidden, because
 * one of those rows covers a whole day on its own.
 */
const SLOT_STYLE = {
  MORNING: { Icon: SunIcon, tile: 'bg-caution-soft text-caution', tone: 'caution' },
  EVENING: { Icon: MoonIcon, tile: 'bg-info-soft text-info', tone: 'info' },
  BOTH: { Icon: SunIcon, tile: 'bg-brand-soft text-brand', tone: 'brand' },
};

/** How a settled card is edged, so the state reads from across the room. */
const STATUS_EDGE = {
  DELIVERED: 'border-2 border-emerald-500 bg-emerald-50/20 shadow-sm',
  UNDELIVERED: 'border-2 border-rose-300 bg-rose-50/20 opacity-80',
  SKIPPED: 'border border-slate-200 bg-slate-50/60 opacity-75',
};

export function RoundStop({ stop }) {
  const { t, locale } = useT();
  const isHi = locale === 'hi';
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic(stop.status);
  const [quantitiesOptimistic, setQuantitiesOptimistic] = useOptimistic(
    {},
    (curr, update) => ({ ...curr, ...update }),
  );
  const [modal, setModal] = useState(null);

  // Slot labels translated
  const SLOT_LABEL = {
    MORNING: t('common.morning', {}, 'Morning'),
    EVENING: t('common.evening', {}, 'Evening'),
    BOTH: t('common.slot', {}, 'All day'),
  };

  const items = stop.items ?? [];
  const settled = status !== 'PENDING';
  const extras = stop.extras ?? [];
  const carryOnly = Boolean(stop.milkless);

  function mark(next, { quantities, ...extra } = {}) {
    startTransition(async () => {
      setStatus(next);
      if (quantities) {
        setQuantitiesOptimistic(quantities);
      }
      const results = await Promise.all(
        items.map((item) =>
          markDelivery({
            deliveryId: item.id,
            status: next,
            ...(quantities?.[item.id] != null ? { quantity: quantities[item.id] } : {}),
            ...extra,
          }),
        ),
      );
      const failed = results.find((result) => !result.ok);
      if (failed) {
        setStatus(stop.status);
        toast.error(failed.message ?? t('common.tryAgain', {}, 'Could not save that.'));
      } else {
        setModal(null);
        if (next === 'DELIVERED') {
          toast.success(t('common.saved', {}, 'Saved'));
        }
      }
    });
  }

  const slot = SLOT_STYLE[stop.slot] ?? SLOT_STYLE.BOTH;
  const dueWindow = stopWindow(stop);
  const address = [stop.addressLine1, stop.addressArea].filter(Boolean).join(', ');

  const isDelivered = status === 'DELIVERED';
  const isUndelivered = status === 'UNDELIVERED';

  return (
    <>
      {settled ? (
        <article
          className={cn(
            'group relative overflow-hidden rounded-2xl border transition-all px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs',
            isDelivered
              ? 'border-emerald-200/90 bg-linear-to-r from-emerald-50/50 to-white hover:border-emerald-300'
              : isUndelivered
                ? 'border-rose-200/90 bg-linear-to-r from-rose-50/50 to-white hover:border-rose-300'
                : 'border-slate-200/90 bg-slate-50/70 hover:border-slate-300',
          )}
          aria-label={`${stop.customerName}, ${status}`}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Status Icon + Customer details */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs',
                  isDelivered
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isUndelivered
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-300 text-slate-700',
                )}
              >
                {isDelivered ? (
                  <CheckIcon className="h-4 w-4 stroke-[3]" />
                ) : isUndelivered ? (
                  <CloseIcon className="h-4 w-4 stroke-[3]" />
                ) : (
                  <span className="text-[9px] font-black uppercase">PAUSE</span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-heading text-sm font-black text-slate-900 truncate">
                    {stop.customerName}
                  </h4>
                  {SLOT_LABEL[stop.slot] ? (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                      {SLOT_LABEL[stop.slot]}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded',
                      isDelivered
                        ? 'bg-emerald-100 text-emerald-800'
                        : isUndelivered
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700',
                    )}
                  >
                    {isDelivered
                      ? t('deliveries.deliveredOnly', {}, 'Delivered')
                      : isUndelivered
                        ? t('deliveries.markMissed', {}, 'Not Delivered')
                        : t('common.paused', {}, 'Paused')}
                  </span>
                </div>

                {/* Items summary */}
                <p className="text-xs font-semibold text-slate-600 truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {items.map((it) => {
                    const qty =
                      quantitiesOptimistic[it.id] ??
                      it.deliveredQuantity ??
                      it.adjustedQuantity ??
                      it.plannedQuantity;
                    return (
                      <span key={it.id} className="inline-flex items-center gap-1">
                        <span className="text-slate-950 font-black">
                          {Number(qty)} {it.unit}
                        </span>
                        <span className="text-slate-600">{it.productName}</span>
                      </span>
                    );
                  })}
                  {extras.length > 0 ? (
                    <span className="text-amber-900 font-bold bg-amber-100/90 px-1.5 py-0.2 rounded text-[10px] border border-amber-200">
                      +{extras.map((e) => `${Number(e.quantity)} ${e.unit} ${e.productName}`).join(', ')}
                    </span>
                  ) : null}
                  {stop.addressArea ? (
                    <span className="text-slate-400 font-normal truncate">· {stop.addressArea}</span>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {stop.customerPhone ? (
                <a
                  href={`tel:${stop.customerPhone}`}
                  aria-label={`Call ${stop.customerName}`}
                  className="tap flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-2xs active:scale-95"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                </a>
              ) : null}

              {isDelivered && !carryOnly ? (
                <button
                  type="button"
                  className="tap flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 font-heading text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all active:scale-95 shadow-2xs"
                  disabled={pending}
                  onClick={() => setModal('partial')}
                  title={t('deliveries.editQty', {}, 'Edit Qty')}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  <span>{t('deliveries.editQty', {}, 'Edit Qty')}</span>
                </button>
              ) : null}

              <button
                type="button"
                className="tap flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-heading text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-95 shadow-2xs"
                disabled={pending}
                onClick={() => mark('PENDING')}
                title={t('common.back', {}, 'Undo')}
              >
                <UndoIcon className="h-3.5 w-3.5" />
                <span>{t('common.back', {}, 'Undo')}</span>
              </button>
            </div>
          </div>
        </article>
      ) : (
        <article
          className="group relative overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs transition-all hover:border-blue-400 hover:shadow-sm"
          aria-label={`${stop.customerName}, ${SLOT_LABEL[stop.slot] ?? ''}`}
        >
          {/* Top status indicator line */}
          <div className="h-1.5 w-full bg-blue-600" />

          {/* ── Header: Who & Where ────────────────────────────────────── */}
          <div className="flex items-start gap-3 p-3.5 sm:p-4">
            <span
              aria-hidden="true"
              className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-2xs', slot.tile)}
            >
              <slot.Icon className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-heading text-base sm:text-lg font-black tracking-tight text-slate-950">
                  {stop.customerName}
                </h3>
                {SLOT_LABEL[stop.slot] ? (
                  <Badge tone={slot.tone}>{SLOT_LABEL[stop.slot]}</Badge>
                ) : null}
              </div>

              {address ? (
                <p className="mt-0.5 flex items-start gap-1 text-xs font-medium text-slate-600">
                  <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span className="truncate">
                    <strong className="text-slate-900">{stop.addressLine1}</strong>
                    {stop.addressArea ? `, ${stop.addressArea}` : ''}
                    {stop.addressLandmark ? (
                      <span className="ml-1 text-[11px] font-medium text-slate-400">({stop.addressLandmark})</span>
                    ) : null}
                  </span>
                </p>
              ) : null}

              {dueWindow ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-500">
                  <ClockIcon className="h-3 w-3 shrink-0 text-slate-400" />
                  {dueWindow}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {stop.customerPhone ? (
                <a
                  href={`tel:${stop.customerPhone}`}
                  aria-label={`Call ${stop.customerName}`}
                  className="tap flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-2xs transition-colors hover:bg-blue-600 hover:text-white active:scale-95"
                >
                  <PhoneIcon className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>

          {stop.deliveryInstructions ? (
            <div className="mx-3.5 mb-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-bold text-amber-900 sm:mx-4 flex items-center gap-1.5">
              <NoteIcon className="h-3.5 w-3.5 shrink-0 text-amber-800" />
              <span>{stop.deliveryInstructions}</span>
            </div>
          ) : null}

          {/* ── What goes out ─────────────────────────────────────────── */}
          {carryOnly ? null : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/40">
              {items.map((item) => (
                <ItemLine key={item.id} item={item} status={status} />
              ))}
            </ul>
          )}

          {/* ── Extras to carry ───────────────────────────────────────── */}
          {extras.length > 0 ? (
            <div className="border-t-2 border-dashed border-amber-300 bg-linear-to-r from-amber-50 via-orange-50/60 to-amber-50 px-3.5 py-2.5 sm:px-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-900">
                  <PackageIcon className="h-3.5 w-3.5 text-amber-800" />
                  <span>{t('deliveries.productOrders', {}, 'Deliver Extra Products Today')}</span>
                </p>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-900">
                  {extras.length} {extras.length === 1 ? t('common.unit', {}, 'item') : t('common.units', {}, 'items')}
                </span>
              </div>
              <ul className="space-y-1.5">
                {extras.map((extra) => (
                  <li key={extra.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/90 border border-amber-200/80 px-2.5 py-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                        <PackageIcon className="h-3 w-3" />
                      </span>
                      <span className="text-slate-900 text-xs">
                        <span className="tnum font-black text-sm text-slate-950">{Number(extra.quantity)}</span>
                        <span className="text-slate-500 font-semibold"> {extra.unit} </span>
                        <strong className="font-heading font-bold text-slate-900">{extra.productName}</strong>
                      </span>
                    </div>
                    <span className="tnum font-extrabold text-xs text-amber-950">
                      {formatPaise(Math.round(Number(extra.amount ?? 0) * 100))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ── Big Ergonomic Quick Actions ───────────────────────────── */}
          <div className="border-t border-slate-200/80 p-3 sm:px-4 bg-white space-y-2">
            {carryOnly ? (
              <a
                href="/milkman/orders"
                className="tap flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white font-heading text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
              >
                {t('nav.orders', {}, 'Open Orders')}
              </a>
            ) : (
              <>
                <button
                  type="button"
                  className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-heading text-sm font-black text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-700 active:scale-[0.98]"
                  disabled={pending}
                  onClick={() => mark('DELIVERED')}
                >
                  {pending ? null : <CheckIcon className="h-5 w-5 stroke-[2.5]" />}
                  <span>
                    {extras.length > 0
                      ? `${t('deliveries.markDelivered', {}, 'MARK DELIVERED')} (+${extras.length} items)`
                      : t('deliveries.markDelivered', {}, 'MARK DELIVERED')}
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="tap flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-heading text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-[0.98]"
                    onClick={() => setModal('partial')}
                  >
                    {isHi ? 'मात्रा बदलें' : t('deliveries.changeQty', {}, 'Change Qty')}
                  </button>
                  <button
                    type="button"
                    className="tap flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 font-heading text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
                    onClick={() => setModal('not')}
                  >
                    {isHi ? 'डिलीवर नहीं हुआ' : t('deliveries.markMissed', {}, 'Not Delivered')}
                  </button>
                </div>
              </>
            )}
          </div>
        </article>
      )}

      {/* ── Delivered a different amount ─────────────────────────────── */}
      <Modal
        open={!carryOnly && modal === 'partial'}
        onClose={() => setModal(null)}
        title={`${t('common.quantity', {}, 'How much')} — ${stop.customerName}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel', {}, 'Cancel')}</Button>
            <Button form={`qty-form-${stop.id}`} type="submit" loading={pending}>
              {status === 'DELIVERED'
                ? t('common.save', {}, 'Save Changes')
                : t('deliveries.markDelivered', {}, 'Mark delivered')}
            </Button>
          </>
        }
      >
        <form
          id={`qty-form-${stop.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const quantities = Object.fromEntries(
              items.map((item) => [item.id, data.get(`qty:${item.id}`)]),
            );
            mark('DELIVERED', { quantities });
          }}
        >
          <p className="text-sm text-ink-muted">
            {t('common.note', {}, 'The bill follows what you actually leave.')}
          </p>
          {items.map((item) => {
            const currentQty = Number(
              quantitiesOptimistic[item.id] ?? item.deliveredQuantity ?? plannedFor(item),
            );
            return (
              <div key={item.id} className="rounded-xl border border-border p-3">
                <p className="mb-2 text-sm font-medium text-ink">
                  {item.productName}
                  <span className="ml-1.5 font-normal text-ink-muted">
                    planned {plannedFor(item)} {item.unit}
                    {item.deliveredQuantity != null ? (
                      <span className="ml-1.5 font-bold text-emerald-700">
                        (delivered {Number(quantitiesOptimistic[item.id] ?? item.deliveredQuantity)} {item.unit})
                      </span>
                    ) : null}
                  </span>
                </p>
                <div className="flex justify-center">
                  <QuantityStepper
                    name={`qty:${item.id}`}
                    defaultValue={currentQty}
                    unit={item.unit}
                  />
                </div>
              </div>
            );
          })}
        </form>
      </Modal>

      {/* ── Not delivered ────────────────────────────────────────────── */}
      <Modal
        open={!carryOnly && modal === 'not'}
        onClose={() => setModal(null)}
        title={t('deliveries.markMissed', {}, 'Why was it not delivered?')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel', {}, 'Cancel')}</Button>
            <Button form={`not-form-${stop.id}`} type="submit" variant="danger" loading={pending}>{t('common.save', {}, 'Save')}</Button>
          </>
        }
      >
        <form
          id={`not-form-${stop.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const reason = data.get('skipReason');
            mark(reason === 'CUSTOMER_ABSENT' ? 'UNDELIVERED' : 'SKIPPED', {
              skipReason: reason,
              note: data.get('note') || undefined,
            });
          }}
        >
          <p className="text-sm text-ink-muted">{t('common.note', {}, 'The customer is not charged either way.')}</p>
          <Select
            name="skipReason"
            label={t('planRequests.reason', {}, 'Reason')}
            options={[
              { value: 'CUSTOMER_ABSENT', label: t('common.missed', {}, 'Nobody home') },
              { value: 'CUSTOMER_REQUEST', label: t('common.skipped', {}, 'Customer asked to skip') },
              { value: 'OUT_OF_STOCK', label: t('common.inactive', {}, 'I ran out') },
              { value: 'OTHER', label: t('common.note', {}, 'Something else') },
            ]}
          />
          <Textarea name="note" label={`${t('common.note', {}, 'Note')} (${t('common.optional', {}, 'optional')})`} maxLength={300} />
        </form>
      </Modal>
    </>
  );
}

/** Declare a day off — every remaining stop is skipped at no charge. */
/** Declare a route day off or holiday — only remaining pending stops are skipped at ₹0. */
export function DayOffButton({ date, count }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-muted hover:border-critical/40 hover:bg-critical-soft hover:text-critical"
      >
        <CalendarIcon className="h-4 w-4" />
        {t('common.calendar', {}, 'Day off / holiday')}
      </Button>

      <HolidayManagerModal
        open={open}
        onClose={() => setOpen(false)}
        defaultDate={date}
        remainingCount={count}
      />
    </>
  );
}

/**
 * The window a stop is due in, for the slot it actually runs.
 *
 * Empty for a stop with no window — plans predate this — and for a carry-only
 * stop, which has no subscription behind it.
 */
function stopWindow(stop) {
  const morning = formatWindow(stop.morningStart, stop.morningEnd);
  const evening = formatWindow(stop.eveningStart, stop.eveningEnd);

  if (stop.slot === 'MORNING') return morning;
  if (stop.slot === 'EVENING') return evening;
  return [morning, evening].filter(Boolean).join(' · ');
}

/** What this line was due to deliver today, adjustment included. */
function plannedFor(item) {
  return Number(item.adjustedQuantity ?? item.plannedQuantity);
}

/**
 * One product on a stop.
 *
 * Shows what is due, what it comes to, and — when they differ — what was
 * originally asked for, so the milkman is never left guessing whether a number
 * is the plan or a change to it.
 */
function ItemLine({ item, status }) {
  const { t } = useT();
  const planned = plannedFor(item);
  const delivered = status === 'DELIVERED' && item.deliveredQuantity != null;
  // Only a genuine difference is a change; confirming the dialog without
  // moving the stepper is not one.
  const adjusted =
    item.adjustedQuantity != null &&
    Number(item.adjustedQuantity) !== Number(item.plannedQuantity);

  const shownQuantity = delivered ? Number(item.deliveredQuantity) : planned;
  const shownPaise = delivered
    ? Math.round(Number(item.amount ?? 0) * 100)
    : Math.round(planned * Number(item.unitPrice ?? 0) * 100);

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4">
      <div className="flex min-w-0 flex-1 items-baseline gap-x-2 gap-y-0.5 flex-wrap">
        <span className={cn('stat-number text-xl font-black leading-none', delivered ? 'text-emerald-600' : 'text-slate-950')}>
          {shownQuantity}
          <span className="ml-1 font-sans text-xs font-bold text-slate-500">{item.unit}</span>
        </span>
        <span className="text-sm font-bold text-slate-900">{item.productName}</span>
        {delivered && Number(item.deliveredQuantity) !== planned ? (
          <span className="text-xs font-medium text-slate-400">{t('planRequests.requestedQty', {}, 'asked')} {planned} {item.unit}</span>
        ) : null}
        {!delivered && adjusted ? (
          <span className="text-xs font-medium text-slate-400">{t('subscriptions.dailyQty', {}, 'usually')} {Number(item.plannedQuantity)} {item.unit}</span>
        ) : null}
        {adjusted ? <Badge tone="caution">{t('dashboard.todayModNotice', {}, 'changed today')}</Badge> : null}
      </div>
      {item.unitPrice ? (
        <div className="shrink-0 text-right">
          <p className="tnum text-sm font-black text-slate-950">{formatPaise(shownPaise)}</p>
          <p className="tnum text-[11px] font-semibold text-slate-400">₹{Number(item.unitPrice)}/{item.unit}</p>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Collapsible section for completed/settled deliveries.
 * Keeps daily round clean and lets the milkman focus on remaining stops.
 */
export function DoneDeliveriesSection({ doneStops, count }) {
  const { t } = useT();
  const [collapsed, setCollapsed] = useState(false);

  if (!doneStops || doneStops.length === 0) return null;

  return (
    <section aria-labelledby="done-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">
            ✓
          </span>
          <h3 id="done-heading" className="font-heading text-sm font-black uppercase tracking-wider text-slate-700">
            {t('common.delivered', {}, 'Done')}
          </h3>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
            {count ?? doneStops.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="tap font-heading text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-xl transition-all"
        >
          {collapsed
            ? `${t('common.viewAll', {}, 'Show')} (${doneStops.length}) ↓`
            : `${t('common.close', {}, 'Hide')} ↑`}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {doneStops.map((stop) => (
            <RoundStop key={stop.id} stop={stop} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Filterable interactive view of the round.
 * Supports filtering by customer search, area dropdown, slot, and status.
 */
export function RoundView({ stops = [], summary = {}, date, isHi = false }) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedSlot, setSelectedSlot] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const areas = useMemo(() => {
    const counts = {};
    for (const stop of stops) {
      const area = stop.addressArea?.trim() || (isHi ? 'अन्य क्षेत्र' : 'Other Area');
      counts[area] = (counts[area] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [stops, isHi]);

  const slots = [
    { value: 'MORNING', label: isHi ? 'सुबह (Morning)' : 'Morning' },
    { value: 'EVENING', label: isHi ? 'शाम (Evening)' : 'Evening' },
  ];

  const pendingCount = stops.filter((s) => s.status === 'PENDING').length;
  const doneCount = stops.filter((s) => s.status !== 'PENDING').length;

  const statusTabs = [
    { value: 'ALL', label: isHi ? 'सभी स्टॉप्स' : 'All Stops', count: stops.length },
    { value: 'PENDING', label: isHi ? 'बाकी' : 'To Deliver', count: pendingCount },
    { value: 'DELIVERED', label: isHi ? 'पूरे हुए' : 'Done', count: doneCount },
  ];

  const filteredStops = useMemo(() => {
    return stops.filter((stop) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = stop.customerName?.toLowerCase().includes(q);
        const matchPhone = stop.customerPhone?.includes(q);
        const matchAddr =
          stop.addressLine1?.toLowerCase().includes(q) ||
          stop.addressArea?.toLowerCase().includes(q) ||
          stop.addressLandmark?.toLowerCase().includes(q);
        const matchItem = stop.items?.some((it) => it.productName?.toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchAddr && !matchItem) return false;
      }
      if (selectedArea !== 'ALL') {
        const stopArea = stop.addressArea?.trim() || (isHi ? 'अन्य क्षेत्र' : 'Other Area');
        if (stopArea !== selectedArea) return false;
      }
      if (selectedSlot !== 'ALL') {
        if (stop.slot !== selectedSlot) return false;
      }
      if (selectedStatus === 'PENDING') {
        if (stop.status !== 'PENDING') return false;
      } else if (selectedStatus === 'DELIVERED') {
        if (stop.status !== 'DELIVERED') return false;
      }
      return true;
    });
  }, [stops, search, selectedArea, selectedSlot, selectedStatus, isHi]);

  const filteredRemaining = filteredStops.filter((s) => s.status === 'PENDING');
  const filteredDone = filteredStops.filter((s) => s.status !== 'PENDING');

  function handleReset() {
    setSearch('');
    setSelectedArea('ALL');
    setSelectedSlot('ALL');
    setSelectedStatus('ALL');
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <MilkmanFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isHi ? 'ग्राहक का नाम, फोन या पता खोजें...' : 'Search customer name, phone, address...'}
        areas={areas}
        selectedArea={selectedArea}
        onAreaChange={setSelectedArea}
        slots={slots}
        selectedSlot={selectedSlot}
        onSlotChange={setSelectedSlot}
        statusTabs={statusTabs}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        totalCount={stops.length}
        filteredCount={filteredStops.length}
        onReset={handleReset}
      />

      {/* ── Stops Display ── */}
      {filteredStops.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <p className="font-heading text-sm font-bold text-slate-800">
            {isHi ? 'कोई स्टॉप मेल नहीं खाता' : 'No deliveries match your filters'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isHi ? 'कृपया अन्य नाम या क्षेत्र आज़माएँ।' : 'Try adjusting your search query or clear the filters.'}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="tap mt-3 inline-flex items-center rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
          >
            {isHi ? 'फिल्टर रीसेट करें' : 'Reset filters'}
          </button>
        </div>
      ) : (
        <>
          {filteredRemaining.length > 0 && (
            <section className="mb-6" aria-labelledby="filtered-remaining-heading">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 id="filtered-remaining-heading" className="font-heading text-sm font-black uppercase tracking-wider text-slate-800">
                    {isHi ? 'डिलीवर करने के लिए (बाकी)' : 'To Deliver (Pending)'}
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                    {filteredRemaining.length}
                  </span>
                </div>
                <DayOffButton date={date} count={filteredRemaining.length} />
              </div>
              <div className="space-y-2.5">
                {filteredRemaining.map((stop) => (
                  <RoundStop key={stop.id} stop={stop} />
                ))}
              </div>
            </section>
          )}

          {filteredDone.length > 0 && (
            <DoneDeliveriesSection doneStops={filteredDone} count={filteredDone.length} />
          )}
        </>
      )}
    </div>
  );
}

