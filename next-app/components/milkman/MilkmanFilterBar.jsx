'use client';

import { useMemo } from 'react';
import { SearchIcon, MapPinIcon, CloseIcon, ChevronDownIcon } from '@/components/ui/Icons.jsx';
import { cn } from '@/components/ui/index.jsx';

/**
 * High-performance, ergonomic filter bar tailored for Milkman operational pages.
 * Supports real-time text searching (by customer name, phone, address),
 * area selection dropdown, status tabs, and quick reset.
 */
export function MilkmanFilterBar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search customer or phone...',
  areas = [],
  selectedArea = 'ALL',
  onAreaChange,
  allAreasLabel,
  statusTabs = [],
  selectedStatus,
  onStatusChange,
  slots = [],
  selectedSlot,
  onSlotChange,
  allSlotsLabel,
  totalCount = 0,
  filteredCount = 0,
  onReset,
  isHi = false,
  className,
}) {
  const isFiltered =
    Boolean(search.trim()) ||
    (selectedArea && selectedArea !== 'ALL') ||
    (selectedSlot && selectedSlot !== 'ALL') ||
    (selectedStatus && selectedStatus !== 'ALL');

  // Safely normalize areas whether passed as strings or { value, label, count } objects
  const normalizedAreas = useMemo(() => {
    return (areas || [])
      .map((a) => {
        if (typeof a === 'string') return { value: a, label: a, count: null };
        return {
          value: a.value ?? a.id ?? a.name ?? '',
          label: a.label ?? a.name ?? a.value ?? '',
          count: a.count ?? null,
        };
      })
      .filter((a) => Boolean(a.value));
  }, [areas]);

  // Safely normalize slots/units whether passed as strings or objects
  const normalizedSlots = useMemo(() => {
    return (slots || [])
      .map((s) => {
        if (typeof s === 'string') return { value: s, label: s, count: null };
        return {
          value: s.value ?? s.id ?? s.name ?? '',
          label: s.label ?? s.name ?? s.value ?? '',
          count: s.count ?? null,
        };
      })
      .filter((s) => Boolean(s.value));
  }, [slots]);

  return (
    <div className={cn('space-y-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs mb-5', className)}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* ── Search Input ── */}
        <div className="relative flex-1 min-w-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ paddingLeft: '2.75rem', paddingRight: search ? '2.5rem' : '1rem' }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="tap absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 active:scale-95"
              aria-label="Clear search"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* ── Area Dropdown Filter ── */}
        {normalizedAreas.length > 0 && onAreaChange ? (
          <div className="relative shrink-0 w-full sm:w-60">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-blue-600">
              <MapPinIcon className="h-4 w-4" />
            </div>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              style={{ paddingLeft: '2.5rem', paddingRight: '2.25rem' }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-bold text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/10 transition-all appearance-none cursor-pointer shadow-2xs"
            >
              <option value="ALL" className="bg-white text-slate-900 font-semibold py-1">
                {allAreasLabel || (isHi ? 'सभी क्षेत्र / सेक्टर' : 'All Areas / Sectors')}
              </option>
              {normalizedAreas.map((a) => (
                <option key={a.value} value={a.value} className="bg-white text-slate-900 font-medium py-1">
                  {a.label} {a.count != null ? `(${a.count})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
              <ChevronDownIcon className="h-4 w-4" />
            </div>
          </div>
        ) : null}

        {/* ── Slot / Unit Dropdown (if passed) ── */}
        {normalizedSlots.length > 0 && onSlotChange ? (
          <div className="relative shrink-0 w-full sm:w-48">
            <select
              value={selectedSlot}
              onChange={(e) => onSlotChange(e.target.value)}
              style={{ paddingLeft: '1rem', paddingRight: '2.25rem' }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-bold text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/10 transition-all appearance-none cursor-pointer shadow-2xs"
            >
              <option value="ALL" className="bg-white text-slate-900 font-semibold py-1">
                {allSlotsLabel || (isHi ? 'सभी विकल्प' : 'All Slots')}
              </option>
              {normalizedSlots.map((s) => (
                <option key={s.value} value={s.value} className="bg-white text-slate-900 font-medium py-1">
                  {s.label} {s.count != null ? `(${s.count})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
              <ChevronDownIcon className="h-4 w-4" />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Segmented Status Tabs & Results Summary Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        {statusTabs && statusTabs.length > 0 && onStatusChange ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {statusTabs.map((tab) => {
              const active = selectedStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onStatusChange(tab.value)}
                  className={cn(
                    'tap flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-heading text-xs font-bold transition-all',
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count != null ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-black',
                        active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700',
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* ── Results Info & Reset ── */}
        <div className="flex items-center gap-2 ml-auto text-xs">
          <span className="font-semibold text-slate-500">
            {isHi ? (
              <>
                दिखा रहे हैं: <strong className="text-slate-900">{filteredCount}</strong> / {totalCount}
              </>
            ) : (
              <>
                Showing <strong className="text-slate-900">{filteredCount}</strong> of {totalCount}
              </>
            )}
          </span>
          {isFiltered && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="tap inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline active:scale-95"
            >
              <span>{isHi ? 'रीसेट करें' : 'Reset'}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
