'use client';

import { useMemo, useState } from 'react';
import { MilkmanFilterBar } from './MilkmanFilterBar.jsx';
import { OrderActions } from './Catalog.jsx';
import { EmptyState, Card, CardBody, CardHeader, Table, Th, Td, Badge, SectionHeading, cn } from '@/components/ui/index.jsx';
import { OrdersIcon, CartIcon, CalendarIcon, MapPinIcon, PhoneIcon, CheckIcon, DeliveryIcon } from '@/components/ui/Icons.jsx';
import { formatDate, formatDateShort, formatInstant } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';

const rupeesToPaise = (value) => Math.round(Number(value ?? 0) * 100);

export function OrdersListWithFilters({ pending = [], accepted = [], history = [], isHi = false, t }) {
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'ACCEPTED' | 'DELIVERED'

  // Combine all orders for area extraction and unified filtering
  const allOrders = useMemo(() => {
    return [
      ...pending.map((o) => ({ ...o, status: 'PENDING' })),
      ...accepted.map((o) => ({ ...o, status: 'ACCEPTED' })),
      ...history.map((o) => ({ ...o, status: 'DELIVERED' })),
    ];
  }, [pending, accepted, history]);

  // Extract distinct areas with live counts
  const areas = useMemo(() => {
    const counts = {};
    allOrders.forEach((o) => {
      let area = (o.customerArea || '').trim();
      if (!area && o.deliveryAddress) {
        const parts = o.deliveryAddress.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          area = parts[parts.length - 2] || parts[parts.length - 1];
        } else if (parts.length === 1) {
          area = parts[0];
        }
      }
      if (area) {
        counts[area] = (counts[area] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({
      value: name,
      label: name,
      count,
    }));
  }, [allOrders]);

  // Filter orders based on search, area, and statusTab
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allOrders.filter((o) => {
      // Status filter
      if (statusTab !== 'ALL' && o.status !== statusTab) {
        return false;
      }

      // Area filter
      if (selectedArea !== 'ALL') {
        const orderArea = (o.customerArea || '').toLowerCase();
        const address = (o.deliveryAddress || '').toLowerCase();
        const target = selectedArea.toLowerCase();
        if (!orderArea.includes(target) && !address.includes(target)) {
          return false;
        }
      }

      // Search filter (customer name, phone, delivery address, product name)
      if (q) {
        const name = (o.customerName || '').toLowerCase();
        const phone = (o.customerPhone || '').toLowerCase();
        const addr = (o.deliveryAddress || '').toLowerCase();
        const product = (o.productName || '').toLowerCase();

        if (!name.includes(q) && !phone.includes(q) && !addr.includes(q) && !product.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allOrders, search, selectedArea, statusTab]);

  const filteredPending = useMemo(() => filteredOrders.filter((o) => o.status === 'PENDING'), [filteredOrders]);
  const filteredAccepted = useMemo(() => filteredOrders.filter((o) => o.status === 'ACCEPTED'), [filteredOrders]);
  const filteredDelivered = useMemo(() => filteredOrders.filter((o) => o.status === 'DELIVERED'), [filteredOrders]);

  const deliveredPaise = useMemo(
    () => filteredDelivered.reduce((sum, o) => sum + rupeesToPaise(o.amount), 0),
    [filteredDelivered],
  );

  const statusOptions = [
    { value: 'ALL', label: isHi ? 'सभी' : 'All', count: allOrders.length },
    { value: 'PENDING', label: isHi ? 'नए' : 'New', count: pending.length },
    { value: 'ACCEPTED', label: isHi ? 'डिलीवर करने के लिए' : 'To Deliver', count: accepted.length },
    { value: 'DELIVERED', label: isHi ? 'डिलीवर हुआ' : 'Delivered', count: history.length },
  ];

  const hasActiveFilters = search.trim() !== '' || selectedArea !== 'ALL' || statusTab !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setSelectedArea('ALL');
    setStatusTab('ALL');
  };

  return (
    <div className="space-y-6">
      {/* ── Filters Bar ──────────────────────────────────────────────── */}
      <MilkmanFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isHi ? 'ग्राहक नाम, फोन, पता या उत्पाद खोजें...' : 'Search customer, phone, address, or item...'}
        areas={areas}
        selectedArea={selectedArea}
        onAreaChange={setSelectedArea}
        statusTabs={statusOptions}
        selectedStatus={statusTab}
        onStatusChange={setStatusTab}
        totalCount={allOrders.length}
        filteredCount={filteredOrders.length}
        onReset={resetFilters}
        isHi={isHi}
      />

      {/* ── Content Sections ────────────────────────────────────────── */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<OrdersIcon className="h-8 w-8 text-brand" />}
          title={isHi ? 'कोई ऑर्डर नहीं मिला' : 'No matching orders found'}
          description={
            hasActiveFilters
              ? isHi
                ? 'आपके चुने गए फ़िल्टर से कोई मेल नहीं खाया। फ़िल्टर बदलें या रीसेट करें।'
                : 'No orders match your search criteria or area filter. Try adjusting or clearing your filters.'
              : isHi
              ? 'वर्तमान में कोई ऑर्डर उपलब्ध नहीं है।'
              : 'There are currently no orders in your queue.'
          }
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="tap inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand/90 transition-all active:scale-95"
              >
                {isHi ? 'सभी फ़िल्टर साफ़ करें' : 'Clear all filters'}
              </button>
            ) : null
          }
        />
      ) : (
        <>
          {/* New / Pending section */}
          {(statusTab === 'ALL' || statusTab === 'PENDING') && filteredPending.length > 0 && (
            <section className="mb-6" aria-labelledby="pending-heading">
              <SectionHeading id="pending-heading" count={filteredPending.length} tone="caution">
                {isHi ? 'नए ऑर्डर' : 'New Orders'}
              </SectionHeading>
              <div className="space-y-3">
                {filteredPending.map((order) => (
                  <OrderCard key={order.id} order={order} accent="bg-caution" isHi={isHi} />
                ))}
              </div>
            </section>
          )}

          {/* Accepted / To Deliver section */}
          {(statusTab === 'ALL' || statusTab === 'ACCEPTED') && filteredAccepted.length > 0 && (
            <section className="mb-6" aria-labelledby="accepted-heading">
              <SectionHeading id="accepted-heading" count={filteredAccepted.length} tone="brand">
                {isHi ? 'डिलीवर करने के लिए' : 'To Hand Over'}
              </SectionHeading>
              <div className="space-y-3">
                {filteredAccepted.map((order) => (
                  <OrderCard key={order.id} order={order} accent="bg-brand" isHi={isHi} />
                ))}
              </div>
            </section>
          )}

          {/* Delivered section */}
          {(statusTab === 'ALL' || statusTab === 'DELIVERED') && filteredDelivered.length > 0 && (
            <section className="mb-6" aria-labelledby="delivered-heading">
              <Card>
                <CardHeader
                  title={isHi ? 'डिलीवर किए गए ऑर्डर' : 'Delivered Orders'}
                  description={
                    isHi
                      ? `${filteredDelivered.length} डिलीवर किए गए · ${formatPaise(deliveredPaise, { whole: true })}`
                      : `${filteredDelivered.length} delivered · ${formatPaise(deliveredPaise, { whole: true })}`
                  }
                />
                <CardBody className="p-0 pt-3">
                  {/* Mobile list */}
                  <ul className="divide-y divide-border md:hidden">
                    {filteredDelivered.map((order) => (
                      <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-positive-soft text-positive">
                          <CheckIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">
                            <span className="tnum">{Number(order.quantity)}</span> {order.unit} {order.productName}
                          </p>
                          <p className="truncate text-xs font-medium text-ink-muted">
                            {order.customerName}
                            {order.customerArea ? ` (${order.customerArea})` : ''} · {formatDateShort(order.orderDate)}
                          </p>
                        </div>
                        <p className="tnum shrink-0 text-sm font-extrabold text-ink">{formatPaise(rupeesToPaise(order.amount))}</p>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <thead>
                        <tr>
                          <Th>{isHi ? 'ग्राहक' : 'Customer'}</Th>
                          <Th>{isHi ? 'क्षेत्र / पता' : 'Area / Address'}</Th>
                          <Th>{isHi ? 'उत्पाद' : 'Item'}</Th>
                          <Th>{isHi ? 'दिनांक' : 'Date'}</Th>
                          <Th numeric>{isHi ? 'राशि' : 'Amount'}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDelivered.map((order) => (
                          <tr key={order.id}>
                            <Td className="font-semibold">{order.customerName}</Td>
                            <Td className="text-xs text-ink-muted max-w-[200px] truncate">
                              {order.customerArea || order.deliveryAddress || '—'}
                            </Td>
                            <Td>
                              <span className="tnum font-bold">{Number(order.quantity)}</span> {order.unit} {order.productName}
                            </Td>
                            <Td className="text-ink-muted">{formatDate(order.orderDate)}</Td>
                            <Td numeric className="font-bold">{formatPaise(rupeesToPaise(order.amount))}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </CardBody>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** One open order card */
function OrderCard({ order, accent, isHi = false }) {
  return (
    <article className="card-surface relative overflow-hidden p-4 transition-shadow hover:shadow-card-hover sm:p-5">
      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', accent)} />

      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <CartIcon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-heading text-base font-extrabold tracking-tight text-ink">{order.customerName}</h3>
            {order.customerArea ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <MapPinIcon className="h-3 w-3 text-slate-500" />
                {order.customerArea}
              </span>
            ) : null}
            <Badge tone={order.status === 'PENDING' ? 'caution' : 'brand'}>
              {order.status === 'PENDING' ? (isHi ? 'नया' : 'New') : isHi ? 'स्वीकृत' : 'Accepted'}
            </Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-ink-muted">
            <CalendarIcon className="h-4 w-4 text-ink-subtle" />
            {formatDateShort(order.orderDate)}
            <span className="text-ink-subtle">·</span>
            <span className="font-medium text-ink-subtle">
              {isHi ? 'ऑर्डर समय' : 'ordered'} {formatInstant(order.createdAt)}
            </span>
          </p>
          {order.deliveryAddress ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-ink-muted">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
              <span>{order.deliveryAddress}</span>
            </p>
          ) : null}
        </div>

        {order.customerPhone ? (
          <a
            href={`tel:${order.customerPhone}`}
            aria-label={`Call ${order.customerName}`}
            title={`Call ${order.customerName}`}
            className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-brand shadow-xs transition-colors hover:bg-brand-soft"
          >
            <PhoneIcon className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-muted/70 px-4 py-3">
        <p className="min-w-0">
          <span className="stat-number text-2xl leading-none text-ink">
            {Number(order.quantity)}
            <span className="ml-1 font-sans text-sm font-semibold text-ink-muted">{order.unit}</span>
          </span>
          <span className="ml-2 text-sm font-bold text-ink">{order.productName}</span>
        </p>
        <div className="shrink-0 text-right">
          <p className="tnum text-base font-extrabold text-ink">{formatPaise(rupeesToPaise(order.amount))}</p>
          {order.unitPrice ? (
            <p className="tnum text-[11px] font-medium text-ink-subtle">₹{Number(order.unitPrice)}/{order.unit}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <OrderActions order={order} />
      </div>
    </article>
  );
}
