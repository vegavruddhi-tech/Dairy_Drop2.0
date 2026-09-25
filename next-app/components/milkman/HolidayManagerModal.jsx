'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Modal, Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { businessDate, addDays } from '@/domain/dates.js';
import { declareDayOff, cancelDayOff } from '@/actions/milkman.actions.js';

const FESTIVAL_PRESETS = [
  { label: 'Diwali / Deepawali', note: 'Dairy closed for Diwali celebrations. Deliveries resume tomorrow 6 AM.' },
  { label: 'Holi Festival', note: 'Dairy closed for Holi festival. Deliveries resume tomorrow 6 AM.' },
  { label: 'Govardhan Puja', note: 'Dairy closed for Govardhan Puja. Deliveries resume tomorrow 6 AM.' },
  { label: 'Dairy Maintenance', note: 'Scheduled plant & chiller maintenance. Deliveries paused today.' },
  { label: 'Personal / Family Event', note: 'Taking a family day off. Deliveries resume tomorrow morning.' },
];

/**
 * High-Aesthetic Milkman Holiday / Route Day-Off Manager Modal.
 * Zero Emojis - Clean Vector SVG icons only.
 */
export function HolidayManagerModal({ open, onClose, defaultDate, remainingCount = 0 }) {
  const [pending, startTransition] = useTransition();

  const today = businessDate();
  const [mode, setMode] = useState('single'); // 'single' | 'range'
  const [startDate, setStartDate] = useState(defaultDate ?? today);
  const [endDate, setEndDate] = useState(defaultDate ?? today);
  const [note, setNote] = useState('');

  const isMultiDay = mode === 'range' && startDate !== endDate;
  const daysCount = isMultiDay
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;

  function selectPreset(presetNote) {
    setNote(presetNote);
  }

  function handleSchedule(event) {
    event.preventDefault();
    if (startDate > endDate && mode === 'range') {
      toast.error('End date cannot be earlier than start date.');
      return;
    }

    startTransition(async () => {
      const result = await declareDayOff({
        startDate,
        endDate: mode === 'range' ? endDate : startDate,
        reason: 'MILKMAN_DAY_OFF',
        note: note.trim() || undefined,
      });

      if (result.ok) {
        toast.success(
          `Day off declared for ${startDate}${isMultiDay ? ` to ${endDate}` : ''}! ${result.data?.skipped ?? 0} pending deliveries skipped at ₹0. Customers notified.`,
        );
        onClose();
      } else {
        toast.error(result.message ?? 'Could not declare day off.');
      }
    });
  }

  function handleCancelHoliday() {
    startTransition(async () => {
      const result = await cancelDayOff({
        startDate,
        endDate: mode === 'range' ? endDate : startDate,
      });

      if (result.ok) {
        toast.success(
          `Day off cancelled! ${result.data?.restored ?? 0} deliveries restored to PENDING.`,
        );
        onClose();
      } else {
        toast.error(result.message ?? 'Could not cancel day off.');
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Declare Route Day Off / Dairy Holiday"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelHoliday}
            loading={pending}
            className="text-xs text-slate-700 font-semibold hover:bg-slate-50"
          >
            Cancel Day Off (Resume Route)
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              form="milkman-holiday-form"
              type="submit"
              variant="danger"
              className="font-bold"
              loading={pending}
            >
              Skip Route ({daysCount} {daysCount === 1 ? 'Day' : 'Days'})
            </Button>
          </div>
        </div>
      }
    >
      <form id="milkman-holiday-form" onSubmit={handleSchedule} className="space-y-4">
        {/* Mode Selector */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('single');
              setEndDate(startDate);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'single'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Single Day Off
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('range');
              setEndDate(addDays(startDate, 1));
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'range'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Multi-Day Holiday Range
          </button>
        </div>

        {/* Date Inputs */}
        <div className={`grid gap-3 ${mode === 'range' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Input
            name="startDate"
            type="date"
            label={mode === 'range' ? 'Start Date' : 'Holiday Date'}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          {mode === 'range' && (
            <Input
              name="endDate"
              type="date"
              label="End Date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          )}
        </div>

        {/* Reason / Festival Quick Presets */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Quick Reason / Festival Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FESTIVAL_PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectPreset(p.note)}
                className="text-xs px-2.5 py-1 rounded-lg font-medium border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Broadcast Message */}
        <Textarea
          name="note"
          label="Broadcast Message to Customers (Sent in notification)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Dairy will be closed for Diwali. Regular morning deliveries resume the day after."
          rows={2}
          maxLength={300}
        />

        {/* Safety Rule Card */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          </div>
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-bold">Safe Operation Guarantee</p>
            <p className="mt-0.5 text-amber-800">
              Only <strong>PENDING</strong> deliveries will be skipped (billed at ₹0). Any stops you have already marked as <strong>DELIVERED</strong> today will remain intact and safely billed.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
