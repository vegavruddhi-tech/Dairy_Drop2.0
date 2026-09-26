'use client';

import { SearchIcon, MapPinIcon, CloseIcon, FilterIcon } from '@/components/ui/Icons.jsx';
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
  statusTabs = [],
  selectedStatus,
  onStatusChange,
  slots = [],
  selectedSlot,
  onSlotChange,
  totalCount = 0,
  filteredCount = 0,
  onReset,
  className,
}) {
  const isFiltered =
    Boolean(search.trim()) ||
    (selectedArea && selectedArea !== 'ALL') ||
    (selectedSlot && selectedSlot !== 'ALL') ||
    (selectedStatus && selectedStatus !== 'ALL');

  return (
    <div className={cn('space-y-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs mb-5', className)}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* ── Search Input ── */}
        <div className="relative flex-1 min-w-0">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9.5 pr-8 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/10 transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-700"
              aria-label="Clear search"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* ── Area Dropdown Filter ── */}
        {areas && areas.length > 0 && onAreaChange ? (
          <div className="relative shrink-0 sm:w-56">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
              <MapPinIcon className="h-4 w-4" />
            </span>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-7 text-xs sm:text-sm font-bold text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/10 transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">All Areas / Sectors</option>
              {areas.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} {a.count != null ? `(${a.count})` : ''}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 text-xs">
              ▼
            </span>
          </div>
        ) : null}

        {/* ── Slot Dropdown (if passed) ── */}
        {slots && slots.length > 0 && onSlotChange ? (
          <div className="relative shrink-0 sm:w-44">
            <select
              value={selectedSlot}
              onChange={(e) => onSlotChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs sm:text-sm font-bold text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/10 transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">All Slots</option>
              {slots.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} {s.count != null ? `(${s.count})` : ''}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 text-xs">
              ▼
            </span>
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
            Showing <strong className="text-slate-900">{filteredCount}</strong> of {totalCount}
          </span>
          {isFiltered && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="tap inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline active:scale-95"
            >
              <span>Reset</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
