'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader, Stat, cn } from '@/components/ui/index.jsx';
import { formatPaise, formatMilli } from '@/domain/money.js';
import {
  EarningsIcon,
  CheckIcon,
  MilkDropIcon,
  CartIcon,
  UsersIcon,
  SparklesIcon,
} from '@/components/ui/Icons.jsx';

/**
 * 6-Month Performance Trends & Customer Increment Analytics.
 * Renders revenue comparison, volume charts, MoM growth badges, and complete monthly breakdown table.
 */
export function PerformanceTrends({ performance }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'revenue' | 'customers' | 'table'
  const { series = [], summary = {} } = performance || {};

  if (!series || series.length === 0) {
    return null;
  }

  // Calculate highest values for chart scaling
  const maxBilledPaise = Math.max(...series.map((s) => s.billedPaise), 1);
  const maxMilkMilli = Math.max(...series.map((s) => s.milkMilli), 1);
  const maxCustomers = Math.max(...series.map((s) => s.customerCount), 1);

  return (
    <div className="space-y-6">
      {/* ── Section Header & View Toggles ───────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">
            <SparklesIcon className="h-3.5 w-3.5" />
            6-Month Growth & Analytics
          </div>
          <h2 className="mt-1 font-heading text-xl font-black text-ink sm:text-2xl">
            Business Performance Report
          </h2>
          <p className="text-xs font-medium text-ink-muted">
            Rolling metrics from {series[0]?.monthLabel} to {series[series.length - 1]?.monthLabel}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center rounded-2xl bg-surface-muted p-1 text-xs font-bold text-ink-muted">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'tap rounded-xl px-3 py-1.5 transition-all',
              activeTab === 'overview'
                ? 'bg-surface text-ink shadow-sm'
                : 'hover:text-ink',
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('revenue')}
            className={cn(
              'tap rounded-xl px-3 py-1.5 transition-all',
              activeTab === 'revenue'
                ? 'bg-surface text-ink shadow-sm'
                : 'hover:text-ink',
            )}
          >
            Revenue Chart
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={cn(
              'tap rounded-xl px-3 py-1.5 transition-all',
              activeTab === 'customers'
                ? 'bg-surface text-ink shadow-sm'
                : 'hover:text-ink',
            )}
          >
            Growth & Volume
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={cn(
              'tap rounded-xl px-3 py-1.5 transition-all',
              activeTab === 'table'
                ? 'bg-surface text-ink shadow-sm'
                : 'hover:text-ink',
            )}
          >
            Full Table
          </button>
        </div>
      </div>

      {/* ── 6-Month Summary Highlights ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="6-Mo Billed"
          value={formatPaise(summary.totalBilledPaise, { whole: true })}
          icon={<EarningsIcon className="h-5 w-5" />}
          tone="brand"
          hint={`6-Mo Total Volume`}
        />
        <Stat
          label="6-Mo Collected"
          value={formatPaise(summary.totalCollectedPaise, { whole: true })}
          icon={<CheckIcon className="h-5 w-5" />}
          tone="positive"
          hint={`${summary.overallCollectionRate}% Recovery Rate`}
        />
        <Stat
          label="Active Households"
          value={summary.currentCustomerCount}
          icon={<UsersIcon className="h-5 w-5" />}
          tone="info"
          hint={
            summary.netCustomerGrowth >= 0
              ? `+${summary.netCustomerGrowth} net growth in 6 mos`
              : `${summary.netCustomerGrowth} in 6 mos`
          }
        />
        <Stat
          label="Total Milk Output"
          value={formatMilli(summary.totalMilkMilli)}
          icon={<MilkDropIcon className="h-5 w-5" />}
          tone="neutral"
          hint={`${summary.totalOrders} extra orders fulfilled`}
        />
      </div>

      {/* ── TAB 1 & 2: Revenue vs Collections Bar Chart ──────────────── */}
      {(activeTab === 'overview' || activeTab === 'revenue') && (
        <Card>
          <CardHeader
            title="Monthly Revenue & Collection Efficiency"
            description="Comparison between Total Billed (Blue) and Actual Collected (Green) per month"
          />
          <CardBody>
            <div className="mt-2 space-y-6">
              <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-56 pt-6 pb-2 border-b border-border">
                {series.map((item) => {
                  const billedHeight = Math.max(8, Math.round((item.billedPaise / maxBilledPaise) * 100));
                  const collectedHeight = Math.max(
                    item.collectedPaise > 0 ? 8 : 0,
                    Math.round((item.collectedPaise / maxBilledPaise) * 100),
                  );

                  return (
                    <div key={item.month} className="group relative flex flex-col items-center h-full justify-end">
                      {/* Tooltip on hover */}
                      <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-xl bg-ink px-2.5 py-1.5 text-center text-[10px] font-bold text-white shadow-lg group-hover:block whitespace-nowrap">
                        <div>{item.monthLabel}</div>
                        <div className="text-sky-300">Billed: {formatPaise(item.billedPaise, { whole: true })}</div>
                        <div className="text-emerald-300">Collected: {formatPaise(item.collectedPaise, { whole: true })} ({item.collectionRate}%)</div>
                      </div>

                      {/* Dual Bar Group */}
                      <div className="flex w-full max-w-[48px] items-end justify-center gap-1 sm:gap-1.5 h-full">
                        {/* Billed Bar */}
                        <div
                          className="w-1/2 rounded-t-lg bg-hero-blue transition-all duration-500 hover:brightness-110"
                          style={{ height: `${billedHeight}%` }}
                          title={`Billed: ${formatPaise(item.billedPaise)}`}
                        />
                        {/* Collected Bar */}
                        <div
                          className="w-1/2 rounded-t-lg bg-emerald-500 transition-all duration-500 hover:brightness-110"
                          style={{ height: `${collectedHeight}%` }}
                          title={`Collected: ${formatPaise(item.collectedPaise)}`}
                        />
                      </div>

                      {/* Month Label */}
                      <span className="mt-2 block truncate text-[11px] font-bold text-ink-muted">
                        {item.monthLabel.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend & Summary Tags */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                    <span className="h-3 w-3 rounded-md bg-hero-blue" />
                    Billed Amount
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                    <span className="h-3 w-3 rounded-md bg-emerald-500" />
                    Collected Amount
                  </span>
                </div>
                <span className="font-semibold text-ink-muted">
                  Overall Collection Rate:{' '}
                  <span className="font-black text-emerald-600">{summary.overallCollectionRate}%</span>
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── TAB 1 & 3: Customer Increment & Litres Volume Trends ──────── */}
      {(activeTab === 'overview' || activeTab === 'customers') && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Customer Increment & Growth Cards */}
          <Card>
            <CardHeader
              title="Customer Growth & Retention"
              description="Active households served and Month-over-Month (MoM) increment"
            />
            <CardBody>
              <div className="space-y-3">
                {series.map((item, idx) => {
                  const share = maxCustomers > 0 ? Math.round((item.customerCount / maxCustomers) * 100) : 0;
                  const isPositive = item.customerIncrement > 0;
                  const isNeutral = item.customerIncrement === 0;

                  return (
                    <div
                      key={item.month}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted/60 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-ink">{item.monthLabel}</span>
                          <span className="font-heading text-sm font-black text-ink">
                            {item.customerCount} <span className="text-xs font-semibold text-ink-muted">households</span>
                          </span>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                          <div
                            className="h-full rounded-full bg-brand transition-all duration-500"
                            style={{ width: `${Math.max(10, share)}%` }}
                          />
                        </div>
                      </div>

                      {/* Increment Badge */}
                      <div className="shrink-0 text-right">
                        {idx === 0 ? (
                          <span className="inline-flex rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-ink-subtle border border-border">
                            Base Month
                          </span>
                        ) : isPositive ? (
                          <span className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700 border border-emerald-200/60">
                            +{item.customerIncrement} (+{item.customerGrowthPct}%)
                          </span>
                        ) : isNeutral ? (
                          <span className="inline-flex rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-ink-muted border border-border">
                            0% change
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700 border border-rose-200/60">
                            {item.customerIncrement} ({item.customerGrowthPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Monthly Milk Output & Daily Average */}
          <Card>
            <CardHeader
              title="Milk Volume & Breakdown"
              description="Total Litres delivered per month (Cow vs. Buffalo)"
            />
            <CardBody>
              <div className="space-y-4">
                {series.map((item) => {
                  const cowPct = item.milkMilli > 0 ? Math.round((item.cowMilli / item.milkMilli) * 100) : 0;
                  const buffaloPct = item.milkMilli > 0 ? Math.round((item.buffaloMilli / item.milkMilli) * 100) : 0;

                  return (
                    <div key={item.month} className="rounded-2xl border border-border/70 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-ink">{item.monthLabel}</p>
                          <p className="text-[11px] font-medium text-ink-muted">
                            Daily Average: <span className="font-bold text-ink">{formatMilli(item.dailyAvgMilli)}/day</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-heading text-base font-black text-ink">{formatMilli(item.milkMilli)}</p>
                          <p className="text-[11px] font-semibold text-ink-muted">{item.deliveryCount} drops</p>
                        </div>
                      </div>

                      {/* Milk Split Bar */}
                      {item.milkMilli > 0 ? (
                        <div className="mt-2.5">
                          <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full bg-sky-500"
                              style={{ width: `${cowPct}%` }}
                              title={`Cow: ${formatMilli(item.cowMilli)}`}
                            />
                            <div
                              className="h-full bg-indigo-600"
                              style={{ width: `${buffaloPct}%` }}
                              title={`Buffalo: ${formatMilli(item.buffaloMilli)}`}
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-ink-muted">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                              Cow: {formatMilli(item.cowMilli)} ({cowPct}%)
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                              Buffalo: {formatMilli(item.buffaloMilli)} ({buffaloPct}%)
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── TAB 1 & 4: Full 6-Month Comparison Data Table ─────────────── */}
      {(activeTab === 'overview' || activeTab === 'table') && (
        <Card>
          <CardHeader
            title="6-Month Detailed Ledger & Performance"
            description="Complete month-by-month financial, volume, and customer breakdown"
          />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-3 pl-4 pr-3">Month</th>
                  <th className="px-3 py-3">Customers</th>
                  <th className="px-3 py-3">MoM Growth</th>
                  <th className="px-3 py-3">Milk Vol</th>
                  <th className="px-3 py-3">Billed (₹)</th>
                  <th className="px-3 py-3">Collected (₹)</th>
                  <th className="px-3 py-3">Outstanding</th>
                  <th className="py-3 pl-3 pr-4 text-right">Recovery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {series.map((item, idx) => (
                  <tr key={item.month} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="py-3 pl-4 pr-3 font-bold text-ink">
                      {item.monthLabel}
                      {idx === series.length - 1 && (
                        <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-black uppercase text-brand">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">
                      {item.customerCount}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {idx === 0 ? (
                        <span className="text-ink-subtle">—</span>
                      ) : item.customerIncrement > 0 ? (
                        <span className="font-bold text-emerald-600">+{item.customerIncrement} ({item.customerGrowthPct}%)</span>
                      ) : item.customerIncrement === 0 ? (
                        <span className="text-ink-muted">0</span>
                      ) : (
                        <span className="font-bold text-rose-600">{item.customerIncrement} ({item.customerGrowthPct}%)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">
                      {formatMilli(item.milkMilli)}
                    </td>
                    <td className="px-3 py-3 font-bold text-ink">
                      {formatPaise(item.billedPaise, { whole: true })}
                    </td>
                    <td className="px-3 py-3 font-bold text-emerald-600">
                      {formatPaise(item.collectedPaise, { whole: true })}
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink-muted">
                      {item.outstandingPaise > 0 ? (
                        <span className="text-amber-600 font-bold">{formatPaise(item.outstandingPaise, { whole: true })}</span>
                      ) : (
                        <span className="text-ink-subtle">₹0</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-black',
                          item.collectionRate >= 90
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.collectionRate >= 60
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700',
                        )}
                      >
                        {item.collectionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border bg-surface-muted/40 font-bold text-ink">
                <tr>
                  <td className="py-3 pl-4 pr-3 uppercase tracking-wider font-extrabold text-[11px]">6-Month Total</td>
                  <td className="px-3 py-3">{summary.currentCustomerCount} active</td>
                  <td className="px-3 py-3">
                    {summary.netCustomerGrowth >= 0 ? `+${summary.netCustomerGrowth} net` : `${summary.netCustomerGrowth} net`}
                  </td>
                  <td className="px-3 py-3">{formatMilli(summary.totalMilkMilli)}</td>
                  <td className="px-3 py-3 text-ink font-black">{formatPaise(summary.totalBilledPaise, { whole: true })}</td>
                  <td className="px-3 py-3 text-emerald-600 font-black">{formatPaise(summary.totalCollectedPaise, { whole: true })}</td>
                  <td className="px-3 py-3 text-amber-600 font-bold">{formatPaise(summary.totalOutstandingPaise, { whole: true })}</td>
                  <td className="py-3 pl-3 pr-4 text-right font-black text-emerald-700">{summary.overallCollectionRate}%</td>
                </tr>
              </tfoot>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
