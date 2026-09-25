'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Modal, Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { businessDate, addDays } from '@/domain/dates.js';
import { setVacation, cancelVacation } from '@/actions/customer.actions.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * Customer Multi-Day Vacation / Skip Dates Range Picker.
 * Dual Language Support (English / Hindi).
 */
export function VacationModal({ open, onClose }) {
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  const today = businessDate();
  const tomorrow = addDays(today, 1);

  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(addDays(tomorrow, 2));
  const [note, setNote] = useState('');
  const [activePreset, setActivePreset] = useState('3days');

  // Compute number of days in the selected range
  const daysCount = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  function applyPreset(preset) {
    setActivePreset(preset);
    if (preset === 'tomorrow') {
      setStartDate(tomorrow);
      setEndDate(tomorrow);
    } else if (preset === 'weekend') {
      const d = new Date(today);
      const day = d.getDay(); // 0 is Sun, 6 is Sat
      const daysUntilSat = (6 - day + 7) % 7 || 7;
      const sat = addDays(today, daysUntilSat);
      const sun = addDays(sat, 1);
      setStartDate(sat);
      setEndDate(sun);
    } else if (preset === '3days') {
      setStartDate(tomorrow);
      setEndDate(addDays(tomorrow, 2));
    } else if (preset === '7days') {
      setStartDate(tomorrow);
      setEndDate(addDays(tomorrow, 6));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (startDate > endDate) {
      toast.error(isHi ? 'अंतिम तिथि प्रारंभ तिथि से पहले नहीं हो सकती।' : 'End date cannot be earlier than start date.');
      return;
    }

    startTransition(async () => {
      const result = await setVacation({
        startDate,
        endDate,
        note: note.trim() || undefined,
      });

      if (result.ok) {
        toast.success(
          isHi
            ? `${startDate} से ${endDate} (${daysCount} दिन) के लिए अवकाश सेट हो गया। आपके दूधवाले को सूचित कर दिया गया है!`
            : `Vacation set for ${startDate} to ${endDate} (${daysCount} days). Your milkman has been notified!`,
        );
        onClose();
      } else {
        toast.error(result.message ?? (isHi ? 'अवकाश सेट नहीं हो सका।' : 'Could not set vacation.'));
      }
    });
  }

  function handleResume() {
    startTransition(async () => {
      const result = await cancelVacation({
        startDate,
        endDate,
      });

      if (result.ok) {
        toast.success(
          isHi
            ? `अवकाश रद्द हुआ। ${startDate} से ${endDate} के लिए नियमित डिलीवरी फिर चालू!`
            : `Vacation cancelled. Regular deliveries resumed for ${startDate} to ${endDate}!`,
        );
        onClose();
      } else {
        toast.error(result.message ?? (isHi ? 'डिलीवरी पुनः चालू नहीं हो सकी।' : 'Could not resume deliveries.'));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isHi ? 'छुट्टी प्लान करें / डिलीवरी रोकें' : 'Plan Vacation / Pause Deliveries'}
      footer={
        <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResume}
            loading={pending}
            className="w-full sm:w-auto text-xs text-ink-muted font-semibold hover:bg-surface-muted order-2 sm:order-1"
          >
            {isHi ? 'डिलीवरी पुनः चालू करें' : 'Resume Deliveries'}
          </Button>

          <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
            <Button variant="ghost" onClick={onClose} disabled={pending} className="flex-1 sm:flex-none">
              {isHi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button
              form="vacation-range-form"
              type="submit"
              className="flex-1 sm:flex-none font-bold whitespace-nowrap"
              loading={pending}
            >
              {isHi
                ? `पुष्टि करें (${daysCount} ${daysCount === 1 ? 'दिन' : 'दिन'})`
                : `Confirm (${daysCount} ${daysCount === 1 ? 'Day' : 'Days'})`}
            </Button>
          </div>
        </div>
      }
    >
      <form id="vacation-range-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Range Presets */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-subtle mb-2">
            {isHi ? 'त्वरित अवधि विकल्प' : 'Quick Duration Presets'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'tomorrow', label: isHi ? 'कल' : 'Tomorrow', sub: isHi ? '1 दिन' : '1 Day' },
              { id: 'weekend', label: isHi ? 'यह सप्ताहांत' : 'This Weekend', sub: isHi ? 'शनि व रवि' : 'Sat & Sun' },
              { id: '3days', label: isHi ? 'अगले 3 दिन' : 'Next 3 Days', sub: isHi ? 'छोटी यात्रा' : 'Quick trip' },
              { id: '7days', label: isHi ? 'अगले 7 दिन' : 'Next 7 Days', sub: isHi ? '1 सप्ताह' : '1 Week' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  activePreset === p.id
                    ? 'border-brand bg-brand-soft text-ink ring-2 ring-brand/20'
                    : 'border-border bg-surface hover:border-ink-subtle/40 text-ink-muted'
                }`}
              >
                <span className="text-xs font-bold">{p.label}</span>
                <span className="text-[10px] text-ink-subtle">{p.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Selectors */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Input
            name="startDate"
            type="date"
            label={isHi ? 'प्रारंभ तिथि' : 'Start Date'}
            min={today}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setActivePreset('custom');
            }}
            required
          />
          <Input
            name="endDate"
            type="date"
            label={isHi ? 'अंतिम तिथि' : 'End Date'}
            min={startDate}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setActivePreset('custom');
            }}
            required
          />
        </div>

        {/* Reason / Note to Milkman */}
        <Textarea
          name="note"
          label={isHi ? 'दूधवाले के लिए संदेश (वैकल्पिक)' : 'Note to Milkman (Optional)'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isHi ? 'जैसे: कुछ दिनों के लिए बाहर जा रहे हैं।' : 'e.g. Traveling out of station for a few days.'}
          rows={2}
          maxLength={300}
        />

        {/* Guarantee Banner */}
        <div className="rounded-2xl border border-brand/15 bg-brand-soft/70 p-3.5 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-sm">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <div className="text-xs text-ink-muted leading-relaxed">
            <p className="font-bold text-ink">{isHi ? 'छुट्टी के दौरान शून्य शुल्क' : 'Zero Charges During Vacation'}</p>
            <p className="mt-0.5 text-ink-muted">
              {isHi
                ? `इन ${daysCount} दिन(ों) के लिए आपकी डिलीवरी स्वतः रोक दी जाएगी। रोके गए दिनों के लिए आपसे ₹0 बिल लिया जाएगा और अगली सुबह से डिलीवरी सुचारू रूप से पुनः चालू हो जाएगी।`
                : `Your deliveries for these ${daysCount} day(s) will be paused automatically. You will be billed exactly ₹0 for all paused days, and deliveries will resume smoothly on the next morning.`}
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
