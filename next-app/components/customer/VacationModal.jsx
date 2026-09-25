'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Modal, Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { businessDate, addDays } from '@/domain/dates.js';
import { setVacation, cancelVacation } from '@/actions/customer.actions.js';

/**
 * High-Aesthetic Customer Multi-Day Vacation / Skip Dates Range Picker.
 * Zero Emojis - Vector SVG Icons only. Pure Blue & White design.
 */
export function VacationModal({ open, onClose }) {
  const [pending, startTransition] = useTransition();

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
      toast.error('End date cannot be earlier than start date.');
      return;
    }

    startTransition(async () => {
      const result = await setVacation({
        startDate,
        endDate,
        note: note.trim() || undefined,
      });

      if (result.ok) {
        toast.success(`Vacation set for ${startDate} to ${endDate} (${daysCount} days). Your milkman has been notified!`);
        onClose();
      } else {
        toast.error(result.message ?? 'Could not set vacation.');
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
        toast.success(`Vacation cancelled. Regular deliveries resumed for ${startDate} to ${endDate}!`);
        onClose();
      } else {
        toast.error(result.message ?? 'Could not resume deliveries.');
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan Vacation / Pause Deliveries"
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
            Resume Deliveries
          </Button>

          <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
            <Button variant="ghost" onClick={onClose} disabled={pending} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              form="vacation-range-form"
              type="submit"
              className="flex-1 sm:flex-none font-bold whitespace-nowrap"
              loading={pending}
            >
              Confirm ({daysCount} {daysCount === 1 ? 'Day' : 'Days'})
            </Button>
          </div>
        </div>
      }
    >
      <form id="vacation-range-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Range Presets */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-subtle mb-2">
            Quick Duration Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'tomorrow', label: 'Tomorrow', sub: '1 Day' },
              { id: 'weekend', label: 'This Weekend', sub: 'Sat & Sun' },
              { id: '3days', label: 'Next 3 Days', sub: 'Quick trip' },
              { id: '7days', label: 'Next 7 Days', sub: '1 Week' },
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
            label="Start Date"
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
            label="End Date"
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
          label="Note to Milkman (Optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Traveling out of station for a few days."
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
            <p className="font-bold text-ink">Zero Charges During Vacation</p>
            <p className="mt-0.5 text-ink-muted">
              Your deliveries for these {daysCount} day(s) will be paused automatically. You will be billed exactly ₹0 for all paused days, and deliveries will resume smoothly on the next morning.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
