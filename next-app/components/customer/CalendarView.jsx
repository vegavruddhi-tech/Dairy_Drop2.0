'use client';

import { useState, useTransition, useMemo } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge } from '@/components/ui/index.jsx';
import { Button, Modal, QuantityStepper, Textarea } from '@/components/ui/interactive.jsx';
import { InfoIcon, VacationIcon, CheckIcon, CloseIcon } from '@/components/ui/Icons.jsx';
import { skipDay, resumeDay, adjustQuantity } from '@/actions/customer.actions.js';
import { formatDate, formatDateShort, formatWindow } from '@/domain/dates.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * Compute the accurate, proper total quantity and status summary for a day.
 * Eliminates awkward "+X more" labels and sums up all delivered or scheduled amounts.
 */
function getDaySummary(dayDeliveries, isHi) {
  if (!dayDeliveries || dayDeliveries.length === 0) {
    return null;
  }

  const deliveredByUnit = {};
  const scheduledByUnit = {};
  let deliveredCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;
  let undeliveredCount = 0;

  for (const d of dayDeliveries) {
    const unit = d.unit || 'L';
    if (d.status === 'DELIVERED') {
      deliveredCount++;
      const q = Number(d.deliveredQuantity ?? 0);
      deliveredByUnit[unit] = (deliveredByUnit[unit] || 0) + q;
    } else if (d.status === 'PENDING') {
      pendingCount++;
      const q = Number(d.adjustedQuantity ?? d.plannedQuantity ?? 0);
      scheduledByUnit[unit] = (scheduledByUnit[unit] || 0) + q;
    } else if (d.status === 'SKIPPED') {
      skippedCount++;
    } else if (d.status === 'UNDELIVERED') {
      undeliveredCount++;
    }
  }

  const formatQty = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

  // All skipped
  if (skippedCount === dayDeliveries.length) {
    return {
      statusType: 'SKIPPED',
      badgeText: isHi ? 'छुट्टी' : 'Skip',
      deliveredCount,
      pendingCount,
      skippedCount,
      undeliveredCount,
      totalCount: dayDeliveries.length,
    };
  }

  // All undelivered / missed
  if (undeliveredCount === dayDeliveries.length) {
    return {
      statusType: 'UNDELIVERED',
      badgeText: isHi ? 'मिस्ड' : 'Miss',
      deliveredCount,
      pendingCount,
      skippedCount,
      undeliveredCount,
      totalCount: dayDeliveries.length,
    };
  }

  // All deliveries completed
  if (deliveredCount > 0 && pendingCount === 0) {
    const entries = Object.entries(deliveredByUnit);
    const badgeText = entries.map(([unit, qty]) => `${formatQty(qty)}${unit}`).join(', ');
    return {
      statusType: 'DELIVERED',
      badgeText,
      fullTotalText: entries.map(([unit, qty]) => `${formatQty(qty)} ${unit}`).join(', '),
      deliveredCount,
      pendingCount,
      skippedCount,
      undeliveredCount,
      totalCount: dayDeliveries.length,
    };
  }

  // Purely scheduled / pending
  if (pendingCount > 0 && deliveredCount === 0) {
    const entries = Object.entries(scheduledByUnit);
    const badgeText = entries.map(([unit, qty]) => `${formatQty(qty)}${unit}`).join(', ');
    return {
      statusType: 'PENDING',
      badgeText,
      fullTotalText: badgeText,
      deliveredCount,
      pendingCount,
      skippedCount,
      undeliveredCount,
      totalCount: dayDeliveries.length,
    };
  }

  // Partial day (some delivered, some still pending)
  if (deliveredCount > 0 && pendingCount > 0) {
    const primaryUnit = Object.keys(deliveredByUnit)[0] || Object.keys(scheduledByUnit)[0] || 'L';
    const deliv = deliveredByUnit[primaryUnit] || 0;
    const sched = scheduledByUnit[primaryUnit] || 0;
    return {
      statusType: 'PARTIAL',
      badgeText: `${formatQty(deliv)}/${formatQty(deliv + sched)}${primaryUnit}`,
      fullTotalText: isHi
        ? `${formatQty(deliv)} डिलीवर, ${formatQty(sched)} निर्धारित`
        : `${formatQty(deliv)} delivered, ${formatQty(sched)} scheduled`,
      deliveredCount,
      pendingCount,
      skippedCount,
      undeliveredCount,
      totalCount: dayDeliveries.length,
    };
  }

  return {
    statusType: 'OTHER',
    badgeText: `${dayDeliveries.length}`,
    deliveredCount,
    pendingCount,
    skippedCount,
    undeliveredCount,
    totalCount: dayDeliveries.length,
  };
}

export function CalendarView({ cells, deliveriesByDate, month, todayDate }) {
  const { locale } = useT();
  const isHi = locale === 'hi';

  // Pick default selected date: today if in month/has deliveries, otherwise first date with deliveries
  const defaultSelectedDate = useMemo(() => {
    if (todayDate && deliveriesByDate[todayDate]?.length) return todayDate;
    if (todayDate && todayDate.startsWith(month)) return todayDate;
    const firstDeliveryDate = Object.keys(deliveriesByDate)
      .filter((d) => d.startsWith(month) && deliveriesByDate[d]?.length)
      .sort()[0];
    return firstDeliveryDate || todayDate || null;
  }, [deliveriesByDate, month, todayDate]);

  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);
  const [modalAction, setModalAction] = useState(null); // { type: 'skip' | 'quantity', delivery }
  const [pending, startTransition] = useTransition();

  const selectedDeliveries = useMemo(() => {
    return (selectedDate ? deliveriesByDate[selectedDate] ?? [] : []).filter(
      (d) => d.status !== 'CANCELLED',
    );
  }, [deliveriesByDate, selectedDate]);

  const selectedDaySummary = useMemo(() => getDaySummary(selectedDeliveries, isHi), [selectedDeliveries, isHi]);

  function handleAction(actionFn, payload, successMsg) {
    startTransition(async () => {
      const result = await actionFn(payload);
      if (result.ok) {
        toast.success(successMsg);
        setModalAction(null);
      } else {
        toast.error(result.message ?? (isHi ? 'कुछ गड़बड़ हुई।' : 'Something went wrong.'));
      }
    });
  }

  const dayHeaders = isHi
    ? ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* ── Calendar Grid Card ────────────────────────────────────── */}
      <Card className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden bg-white">
        <CardBody className="p-3 sm:p-6">
          {/* Day of Week Headers */}
          <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
            {dayHeaders.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`blank-${index}`}
                    className="min-h-[48px] sm:min-h-[58px] aspect-[1/1.05] rounded-xl sm:rounded-2xl bg-slate-50/40 border border-transparent"
                  />
                );
              }

              const dayDeliveries = (deliveriesByDate[date] ?? []).filter(
                (d) => d.status !== 'CANCELLED',
              );
              const hasDeliveries = dayDeliveries.length > 0;
              const dayNumber = Number(date.slice(8));
              const isToday = date === todayDate;
              const isSelected = date === selectedDate;
              const summary = getDaySummary(dayDeliveries, isHi);

              // Refined styling for clean, compact readability
              let cellStyle = 'bg-slate-50/40 border-slate-200/70 text-slate-400 hover:bg-slate-50 hover:border-slate-300';
              let badgeElement = null;

              if (hasDeliveries && summary) {
                if (summary.statusType === 'DELIVERED') {
                  cellStyle =
                    'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:border-emerald-500 hover:bg-emerald-100/70';
                  badgeElement = (
                    <span className="inline-block max-w-full truncate rounded-md bg-emerald-600 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-white leading-none shadow-2xs">
                      {summary.badgeText}
                    </span>
                  );
                } else if (summary.statusType === 'PENDING') {
                  cellStyle =
                    'bg-blue-50/80 border-blue-200 text-blue-950 hover:border-blue-400 hover:bg-blue-100/60';
                  badgeElement = (
                    <span className="inline-block max-w-full truncate rounded-md bg-blue-600 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white leading-none shadow-2xs">
                      {summary.badgeText}
                    </span>
                  );
                } else if (summary.statusType === 'PARTIAL') {
                  cellStyle =
                    'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:border-emerald-500';
                  badgeElement = (
                    <span className="inline-block max-w-full truncate rounded-md bg-emerald-700 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9px] font-extrabold text-white leading-none shadow-2xs">
                      {summary.badgeText}
                    </span>
                  );
                } else if (summary.statusType === 'SKIPPED') {
                  cellStyle =
                    'bg-amber-50/80 border-amber-300 text-amber-900 hover:border-amber-400 hover:bg-amber-100/60';
                  badgeElement = (
                    <span className="inline-block max-w-full truncate rounded-md bg-amber-200 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-900 border border-amber-300 leading-none">
                      {isHi ? 'छुट्टी' : 'Skip'}
                    </span>
                  );
                } else if (summary.statusType === 'UNDELIVERED') {
                  cellStyle =
                    'bg-rose-50/80 border-rose-300 text-rose-950 hover:border-rose-400 hover:bg-rose-100/60';
                  badgeElement = (
                    <span className="inline-block max-w-full truncate rounded-md bg-rose-600 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white leading-none">
                      {isHi ? 'मिस्ड' : 'Miss'}
                    </span>
                  );
                } else {
                  cellStyle = 'bg-slate-100 border-slate-200 text-slate-600';
                  badgeElement = (
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500">
                      {summary.badgeText}
                    </span>
                  );
                }
              }

              // Selected state ring
              const selectedRing = isSelected
                ? 'ring-2 ring-blue-600 ring-offset-1 z-10 border-blue-600 shadow-sm'
                : '';

              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`group relative flex min-h-[48px] sm:min-h-[58px] aspect-[1/1.05] flex-col items-center justify-between rounded-xl sm:rounded-2xl border p-1 sm:p-1.5 transition-all select-none text-center w-full overflow-hidden ${cellStyle} ${selectedRing} ${
                    hasDeliveries ? 'cursor-pointer' : 'cursor-pointer opacity-70'
                  }`}
                >
                  {/* Date Header inside Cell */}
                  <div className="flex items-center justify-between w-full px-0.5">
                    <span
                      className={`text-xs sm:text-sm font-extrabold leading-none ${
                        summary?.statusType === 'SKIPPED'
                          ? 'line-through text-amber-800/80'
                          : summary?.statusType === 'DELIVERED'
                          ? 'text-emerald-950'
                          : isToday
                          ? 'text-blue-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNumber}
                    </span>

                    {/* Today indicator dot */}
                    {isToday && (
                      <span className="flex h-1.5 w-1.5 relative" title="Today">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600" />
                      </span>
                    )}
                  </div>

                  {/* Clean accurate total badge without text wrap overflow */}
                  <div className="flex w-full items-center justify-center pb-0.5 min-h-[16px]">
                    {badgeElement}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Color Legend with crisp indicators */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-emerald-500 shadow-xs" />
                <span className="text-slate-800">{isHi ? 'डिलीवर हुआ' : 'Delivered'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-blue-500 shadow-xs" />
                <span className="text-slate-800">{isHi ? 'निर्धारित' : 'Scheduled'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-amber-400 shadow-xs" />
                <span className="text-slate-800">{isHi ? 'छुट्टी' : 'Skipped'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-rose-500 shadow-xs" />
                <span className="text-slate-800">{isHi ? 'मिस्ड' : 'Missed'}</span>
              </span>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <InfoIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>
                {isHi
                  ? 'नीचे डिलीवरी देखने व प्रबंधित करने के लिए किसी भी तारीख पर क्लिक करें।'
                  : 'Click any date to view and manage deliveries directly below.'}
              </span>
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ── Day Deliveries Details Section (Below Calendar) ────────── */}
      {selectedDate && (
        <Card className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden bg-white">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-b border-slate-200/70 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs font-extrabold text-sm">
                {selectedDate.slice(8)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-base sm:text-lg font-black text-slate-900">
                    {formatDateShort(selectedDate)}, {selectedDate.slice(0, 4)}
                  </h3>
                  {selectedDate === todayDate && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 border border-blue-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                      {isHi ? 'आज' : 'Today'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {(() => {
                    if (selectedDeliveries.length === 0) return isHi ? 'इस दिन कोई डिलीवरी नहीं है' : 'No deliveries on this day';
                    const parts = [];
                    if (selectedDaySummary?.deliveredCount > 0) {
                      parts.push(`${selectedDaySummary.deliveredCount} ${isHi ? 'डिलीवर हुआ' : 'delivered'}`);
                    }
                    if (selectedDaySummary?.pendingCount > 0) {
                      parts.push(`${selectedDaySummary.pendingCount} ${isHi ? 'निर्धारित' : 'scheduled'}`);
                    }
                    if (selectedDaySummary?.skippedCount > 0) {
                      parts.push(`${selectedDaySummary.skippedCount} ${isHi ? 'छुट्टी' : 'skipped'}`);
                    }
                    if (selectedDaySummary?.undeliveredCount > 0) {
                      parts.push(`${selectedDaySummary.undeliveredCount} ${isHi ? 'मिस्ड' : 'missed'}`);
                    }
                    const breakdown = parts.length > 0 ? ` · ${parts.join(', ')}` : '';
                    return `${selectedDeliveries.length} ${
                      isHi
                        ? 'डिलीवरी'
                        : selectedDeliveries.length === 1
                        ? 'delivery'
                        : 'deliveries'
                    }${breakdown}`;
                  })()}
                </p>
              </div>
            </div>

            {/* Total summary pill for the day */}
            {selectedDeliveries.length > 0 && selectedDaySummary && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-slate-100/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200/60">
                  <span className="text-slate-500 font-medium">{isHi ? 'दिन का कुल:' : 'Day Total:'}</span>
                  <span className="text-slate-900 font-extrabold text-sm">
                    {selectedDaySummary.fullTotalText || selectedDaySummary.badgeText}
                  </span>
                  {selectedDaySummary.deliveredCount > 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                      {isHi ? 'डिलीवर हुआ' : 'Delivered'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <CardBody className="p-4 sm:p-6">
            {selectedDeliveries.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3 border border-slate-200">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h4 className="font-heading text-base font-bold text-slate-800">
                  {isHi ? 'कोई डिलीवरी निर्धारित नहीं है' : 'No Deliveries Scheduled'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {isHi
                    ? `${formatDate(selectedDate)} के लिए कोई डिलीवरी नहीं है। डिलीवरी आपके सक्रिय प्लान के अनुसार पहुंचेगी।`
                    : `There are no scheduled deliveries for ${formatDate(selectedDate)}. Deliveries will arrive based on your active subscription plan.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDeliveries.map((delivery) => {
                  const quantity = Number(delivery.adjustedQuantity ?? delivery.plannedQuantity);
                  const planned = Number(delivery.plannedQuantity);
                  const isAdjusted = delivery.adjustedQuantity != null && quantity !== planned;
                  const isPending = delivery.status === 'PENDING';
                  const isSkipped = delivery.status === 'SKIPPED';
                  const isDelivered = delivery.status === 'DELIVERED';
                  const isUndelivered = delivery.status === 'UNDELIVERED';
                  const morning = formatWindow(delivery.morningStart, delivery.morningEnd);
                  const evening = formatWindow(delivery.eveningStart, delivery.eveningEnd);

                  const displayQty = isDelivered
                    ? Number(delivery.deliveredQuantity)
                    : quantity;
                  const totalCost = (displayQty * Number(delivery.unitPrice)).toFixed(2);

                  return (
                    <div
                      key={delivery.id}
                      className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 space-y-3.5 hover:border-blue-200 transition-colors shadow-2xs"
                    >
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-heading text-base font-bold text-slate-900">
                            {delivery.productName}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {delivery.slot === 'MORNING'
                              ? `${isHi ? 'सुबह की डिलीवरी' : 'Morning Delivery'}${morning ? ` (${morning})` : ''}`
                              : delivery.slot === 'EVENING'
                              ? `${isHi ? 'शाम की डिलीवरी' : 'Evening Delivery'}${evening ? ` (${evening})` : ''}`
                              : isHi ? 'सुबह व शाम' : 'Morning & Evening'}
                          </p>
                        </div>

                        <StatusBadge status={delivery.status} locale={locale} />
                      </div>

                      {/* Quantity & Price Card */}
                      <div className="flex items-baseline justify-between rounded-xl bg-white p-3 border border-slate-200/70">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {isDelivered ? (isHi ? 'डिलीवर हुई मात्रा' : 'Delivered Quantity') : (isHi ? 'निर्धारित मात्रा' : 'Scheduled Quantity')}
                          </p>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-2xl font-black text-slate-900 tnum">
                              {displayQty}
                            </span>
                            <span className="text-xs font-bold text-slate-500">{delivery.unit}</span>
                            {isAdjusted && (
                              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                {isHi ? `बदला गया (${planned} ${delivery.unit} से)` : `Changed from ${planned} ${delivery.unit}`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {isHi ? 'दर / कुल योग' : 'Rate / Item Total'}
                          </p>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">
                            ₹{Number(delivery.unitPrice).toFixed(2)} / {delivery.unit}
                          </p>
                          {isDelivered && (
                            <p className="text-[11px] font-extrabold text-emerald-700">
                              ₹{totalCost} {isHi ? 'बिल हुआ' : 'billed'}
                            </p>
                          )}
                          {(isSkipped || isUndelivered) && (
                            <p className="text-[11px] font-semibold text-slate-400">
                              ₹0.00 {isHi ? '(बिल नहीं हुआ)' : '(not billed)'}
                            </p>
                          )}
                          {isPending && (
                            <p className="text-[11px] font-semibold text-slate-500">
                              ₹{totalCost} {isHi ? 'अनुमानित' : 'est.'}
                            </p>
                          )}
                        </div>
                      </div>

                      {delivery.note && (
                        <p className="text-xs text-slate-600 italic bg-white/70 p-2.5 rounded-lg border border-slate-200/50">
                          {isHi ? 'नोट:' : 'Note:'} "{delivery.note}"
                        </p>
                      )}

                      {/* Status Confirmation or Actions */}
                      {isDelivered && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200">
                          <span>✓</span>
                          <span>{isHi ? 'आपके दूधवाले द्वारा आपके दरवाजे पर डिलीवर किया गया' : 'Delivered to your doorstep by your milkman'}</span>
                        </div>
                      )}

                      {isUndelivered && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50/80 px-3 py-2 rounded-xl border border-rose-200">
                          <span>✕</span>
                          <span>{isHi ? 'डिलीवरी नहीं हो सकी · इसका आपसे कोई शुल्क नहीं लिया गया' : 'Marked unfulfilled · You were not billed for this delivery'}</span>
                        </div>
                      )}

                      {/* Actions for Pending Deliveries */}
                      {isPending && (
                        <div className="flex gap-2 pt-1 border-t border-slate-200/60">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 font-semibold text-xs"
                            onClick={() => {
                              setModalAction({ type: 'quantity', delivery });
                            }}
                          >
                            {isHi ? 'मात्रा बदलें' : 'Change Quantity'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 font-semibold text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setModalAction({ type: 'skip', delivery });
                            }}
                          >
                            {isHi ? 'यह दिन छोड़ें' : 'Skip This Day'}
                          </Button>
                        </div>
                      )}

                      {/* Action for Skipped Deliveries */}
                      {isSkipped && (
                        <div className="space-y-2 pt-1 border-t border-slate-200/60">
                          {delivery.skipReason === 'MILKMAN_DAY_OFF' ||
                          delivery.note?.toLowerCase().includes('day off') ||
                          delivery.note?.toLowerCase().includes('holiday') ? (
                            <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50/90 px-3 py-2 rounded-xl border border-amber-200 font-semibold">
                              <VacationIcon className="h-4 w-4 text-amber-700 shrink-0" />
                              <span>{isHi ? 'डेयरी अवकाश / दूधवाला अवकाश (कोई बिल नहीं)' : 'Dairy Holiday / Milkman Day Off (You are not billed)'}</span>
                            </div>
                          ) : selectedDate >= todayDate ? (
                            <>
                              <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-medium">
                                {isHi ? 'आपके अनुरोध पर छुट्टी की गई (कोई बिल नहीं)।' : 'Skipped at your request (not billed).'}
                              </div>
                              <Button
                                size="sm"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                                loading={pending}
                                onClick={() =>
                                  handleAction(
                                    resumeDay,
                                    { deliveryId: delivery.id },
                                    isHi ? `${formatDateShort(selectedDate)} के लिए डिलीवरी फिर चालू की गई।` : `Resumed delivery for ${formatDateShort(selectedDate)}.`,
                                  )
                                }
                              >
                                {isHi ? 'यह डिलीवरी पुनः चालू करें' : 'Resume This Delivery'}
                              </Button>
                            </>
                          ) : (
                            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                              {isHi ? 'छोड़ी गई डिलीवरी (बीती तारीख · कोई बिल नहीं)।' : 'Skipped delivery (past date · not billed).'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Sub-Modal: Skip Day ────────────────────────────────────── */}
      <Modal
        open={modalAction?.type === 'skip'}
        onClose={() => setModalAction(null)}
        title={isHi ? 'यह डिलीवरी छोड़ें?' : 'Skip This Delivery?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalAction(null)}>
              {isHi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button form="calendar-skip-form" type="submit" variant="danger" loading={pending}>
              {isHi ? 'छुट्टी कन्फर्म करें' : 'Confirm Skip'}
            </Button>
          </>
        }
      >
        {modalAction?.delivery && (
          <form
            id="calendar-skip-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = new FormData(event.currentTarget).get('reason');
              handleAction(
                skipDay,
                { deliveryId: modalAction.delivery.id, reason: reason ? String(reason) : undefined },
                isHi ? 'इस दिन के लिए डिलीवरी छोड़ दी गई।' : 'Delivery skipped for this day.',
              );
            }}
          >
            <p className="text-sm text-slate-600">
              {isHi ? (
                <>
                  आपका दूधवाला इस दिन <strong className="text-slate-900">{modalAction.delivery.productName}</strong> डिलीवर नहीं करेगा। इस छोड़ी गई डिलीवरी का आपसे कोई शुल्क नहीं लिया जाएगा।
                </>
              ) : (
                <>
                  Your milkman will not deliver{' '}
                  <strong className="text-slate-900">{modalAction.delivery.productName}</strong> on this
                  day. You will not be billed for this skipped delivery.
                </>
              )}
            </p>

            <Textarea
              name="reason"
              label={isHi ? 'कारण (वैकल्पिक)' : 'Reason (optional)'}
              placeholder={isHi ? 'जैसे: शहर से बाहर हैं, पारिवारिक कार्यक्रम...' : 'e.g. Out of town, family function...'}
              maxLength={200}
            />
          </form>
        )}
      </Modal>

      {/* ── Sub-Modal: Change Quantity ─────────────────────────────── */}
      <Modal
        open={modalAction?.type === 'quantity'}
        onClose={() => setModalAction(null)}
        title={isHi ? 'इस दिन के लिए मात्रा बदलें' : 'Change Quantity for This Day'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalAction(null)}>
              {isHi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button form="calendar-qty-form" type="submit" loading={pending}>
              {isHi ? 'मात्रा सुरक्षित करें' : 'Save Quantity'}
            </Button>
          </>
        }
      >
        {modalAction?.delivery && (
          <form
            id="calendar-qty-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const qty = new FormData(event.currentTarget).get('quantity');
              handleAction(
                adjustQuantity,
                { deliveryId: modalAction.delivery.id, quantity: Number(qty) },
                isHi ? `मात्रा ${qty} ${modalAction.delivery.unit} अपडेट हो गई।` : `Quantity updated to ${qty} ${modalAction.delivery.unit}.`,
              );
            }}
          >
            <p className="text-sm text-slate-600">
              {isHi ? (
                <>
                  केवल इस तारीख के लिए <strong className="text-slate-900">{modalAction.delivery.productName}</strong> की मात्रा बदलें।
                </>
              ) : (
                <>
                  Change quantity for{' '}
                  <strong className="text-slate-900">{modalAction.delivery.productName}</strong> on this
                  date only.
                </>
              )}
            </p>

            <div className="flex flex-col items-center justify-center py-2 gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isHi ? 'मात्रा' : 'Quantity'} ({modalAction.delivery.unit})
              </label>
              <QuantityStepper
                name="quantity"
                defaultValue={Number(
                  modalAction.delivery.adjustedQuantity ?? modalAction.delivery.plannedQuantity,
                )}
                step={0.5}
                min={0.5}
                max={20}
                unit={modalAction.delivery.unit}
              />
            </div>

            <p className="text-center text-xs text-slate-500">
              {isHi
                ? 'आपके दूधवाले की डिलीवरी शीट इस दिन के लिए अपडेट हो जाएगी।'
                : "Your milkman's round sheet will be updated for this day."}
            </p>
          </form>
        )}
      </Modal>
    </div>
  );
}
