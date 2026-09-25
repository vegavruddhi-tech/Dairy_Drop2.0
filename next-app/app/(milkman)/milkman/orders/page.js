import { requireMilkman } from '@/auth/session.js';
import { formatDate, formatDateShort, formatInstant } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import { getT, getLocale } from '@/i18n/server.js';
import * as productService from '@/services/product.service.js';

import { EmptyState, Card, CardBody, CardHeader, Table, Th, Td, Stat, SectionHeading, Badge, cn } from '@/components/ui/index.jsx';
import { OrdersIcon, CartIcon, CalendarIcon, MapPinIcon, PhoneIcon, CheckIcon, DeliveryIcon } from '@/components/ui/Icons.jsx';
import { OrderActions } from '@/components/milkman/Catalog.jsx';

export const metadata = { title: 'Orders' };

const rupeesToPaise = (value) => Math.round(Number(value ?? 0) * 100);

/**
 * Extras: paneer, ghee, curd — anything a customer orders on top of the milk.
 */
export default async function OrdersPage() {
  const actor = await requireMilkman();
  const t = await getT();
  const locale = await getLocale();
  const isHi = locale === 'hi';

  const [pending, accepted, history] = await Promise.all([
    productService.listOrders(actor, { status: 'PENDING', limit: 50 }),
    productService.listOrders(actor, { status: 'ACCEPTED', limit: 50 }),
    productService.listOrders(actor, { status: 'DELIVERED', limit: 30 }),
  ]);

  const open = pending.length + accepted.length;
  const openPaise = [...pending, ...accepted].reduce((total, order) => total + rupeesToPaise(order.amount), 0);
  const historyPaise = history.reduce((total, order) => total + rupeesToPaise(order.amount), 0);

  const subtitle =
    open === 0
      ? isHi
        ? 'कोई ऑर्डर खुला नहीं है — सभी उत्पाद डिलीवर हो चुके हैं।'
        : t('orders.nothingOpen', {}, 'Nothing open — every order is handed over.')
      : [
          `${open} ${isHi ? 'खुले ऑर्डर' : t('orders.open', {}, 'open')}`,
          pending.length ? `${pending.length} ${isHi ? 'नए' : t('orders.new', {}, 'new')}` : null,
          accepted.length ? `${accepted.length} ${isHi ? 'डिलीवर करने के लिए' : t('orders.toHandOver', {}, 'to hand over')}` : null,
          isHi ? `${formatPaise(openPaise, { whole: true })} कुल मान` : `${formatPaise(openPaise, { whole: true })} in play`,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
              {pending.length > 0 ? (
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200" />
              ) : null}
              {isHi ? 'अतिरिक्त उत्पाद' : t('orders.extras', {}, 'Extras')}
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {isHi ? 'अतिरिक्त उत्पाद ऑर्डर' : t('orders.title', {}, 'Orders')}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
          </div>

          <div className="flex shrink-0 flex-col items-center rounded-2xl border border-white/20 bg-white/15 px-4 py-2 backdrop-blur-md">
            <span className="stat-number text-3xl leading-none text-white">{open}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
              {isHi ? 'खुले' : t('orders.open', {}, 'open')}
            </span>
          </div>
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={isHi ? 'नए' : t('orders.new', {}, 'New')}
          value={pending.length}
          icon={<CartIcon className="h-5 w-5" />}
          tone={pending.length ? 'caution' : 'neutral'}
          hint={isHi ? 'आपकी स्वीकृति की प्रतीक्षा' : t('orders.waitingForYes', {}, 'Waiting for your yes')}
        />
        <Stat
          label={isHi ? 'डिलीवर करने के लिए' : t('orders.toHandOver', {}, 'To hand over')}
          value={accepted.length}
          icon={<DeliveryIcon className="h-5 w-5" />}
          tone={accepted.length ? 'brand' : 'neutral'}
          hint={isHi ? 'राउंड में साथ ले जाने के लिए' : t('orders.ridingOnRound', {}, 'Riding on your round')}
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label={isHi ? 'डिलीवर हुआ' : t('orders.delivered', {}, 'Delivered')}
            value={history.length}
            icon={<CheckIcon className="h-5 w-5" />}
            tone="positive"
            hint={history.length ? `${formatPaise(historyPaise, { whole: true })} · ${history.length}` : (isHi ? 'अभी कुछ नहीं' : t('common.noData', {}, 'Nothing yet'))}
          />
        </div>
      </div>

      {/* ── Open orders ───────────────────────────────────────────────── */}
      {open === 0 ? (
        <div className="mb-6">
          <EmptyState
            icon={<OrdersIcon className="h-8 w-8 text-brand" />}
            title={isHi ? 'कोई खुला ऑर्डर नहीं है' : t('orders.noOpenOrders', {}, 'No open orders')}
            description={
              isHi
                ? 'जब कोई ग्राहक पनीर, घी या आपके कैटलॉग से कोई उत्पाद ऑर्डर करेगा, तो वह यहाँ स्वीकार करने और राउंड पर ले जाने के लिए आएगा।'
                : t('orders.noOpenOrdersDesc', {}, 'When a customer orders paneer, ghee or anything from your catalogue, it lands here for you to accept and carry on the round.')
            }
            tip={
              isHi
                ? 'स्वीकृत ऑर्डर डिलीवरी शीट में दिखाई देते हैं ताकि कोई भी सामान छूटे नहीं।'
                : t('orders.noOpenOrdersTip', {}, 'Accepted orders show up on the stop card in Deliveries under “Also carry”, so nothing is forgotten on the bike.')
            }
          />
        </div>
      ) : (
        [
          { key: 'new', title: isHi ? 'नए ऑर्डर' : t('orders.new', {}, 'New'), tone: 'caution', rows: pending, accent: 'bg-caution' },
          { key: 'accepted', title: isHi ? 'डिलीवर करने के लिए' : t('orders.toHandOver', {}, 'To hand over'), tone: 'brand', rows: accepted, accent: 'bg-brand' },
        ].map((section) =>
          section.rows.length > 0 ? (
            <section key={section.key} className="mb-8" aria-labelledby={`${section.key}-heading`}>
              <SectionHeading id={`${section.key}-heading`} count={section.rows.length} tone={section.tone}>
                {section.title}
              </SectionHeading>
              <div className="space-y-3">
                {section.rows.map((order) => (
                  <OrderCard key={order.id} order={order} accent={section.accent} t={t} isHi={isHi} />
                ))}
              </div>
            </section>
          ) : null,
        )
      )}

      {/* ── Delivered ─────────────────────────────────────────────────── */}
      {history.length > 0 ? (
        <Card>
          <CardHeader
            title={isHi ? 'डिलीवर किए गए ऑर्डर' : t('orders.deliveredHeading', {}, 'Delivered')}
            description={
              isHi
                ? `${history.length} डिलीवर किए गए · ${formatPaise(historyPaise, { whole: true })}`
                : `${history.length} ${t('orders.delivered', {}, 'handed over')} · ${formatPaise(historyPaise, { whole: true })}`
            }
          />
          <CardBody className="p-0 pt-3">
            {/* Phone: one row per order. */}
            <ul className="divide-y divide-border md:hidden">
              {history.map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-positive-soft text-positive">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      <span className="tnum">{Number(order.quantity)}</span> {order.unit} {order.productName}
                    </p>
                    <p className="truncate text-xs font-medium text-ink-muted">
                      {order.customerName} · {formatDateShort(order.orderDate)}
                    </p>
                  </div>
                  <p className="tnum shrink-0 text-sm font-extrabold text-ink">{formatPaise(rupeesToPaise(order.amount))}</p>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>{isHi ? 'ग्राहक' : t('orders.customer', {}, 'Customer')}</Th>
                    <Th>{isHi ? 'उत्पाद' : t('orders.item', {}, 'Item')}</Th>
                    <Th>{isHi ? 'दिनांक' : t('orders.date', {}, 'Date')}</Th>
                    <Th numeric>{isHi ? 'राशि' : t('orders.amount', {}, 'Amount')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((order) => (
                    <tr key={order.id}>
                      <Td>{order.customerName}</Td>
                      <Td>
                        <span className="tnum">{Number(order.quantity)}</span> {order.unit} {order.productName}
                      </Td>
                      <Td className="text-ink-muted">{formatDate(order.orderDate)}</Td>
                      <Td numeric>{formatPaise(rupeesToPaise(order.amount))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

/** One open order: who, what, for when, and the buttons that move it on. */
function OrderCard({ order, accent, t, isHi = false }) {
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
            <Badge tone={order.status === 'PENDING' ? 'caution' : 'brand'}>
              {order.status === 'PENDING'
                ? isHi ? 'नया' : (t ? t('orders.new', {}, 'New') : 'New')
                : isHi ? 'स्वीकृत' : (t ? t('common.approved', {}, 'Accepted') : 'Accepted')}
            </Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-ink-muted">
            <CalendarIcon className="h-4 w-4 text-ink-subtle" />
            {formatDateShort(order.orderDate)}
            <span className="text-ink-subtle">·</span>
            <span className="font-medium text-ink-subtle">
              {isHi ? 'ऑर्डर समय' : t ? t('orders.orderedAt', {}, 'ordered') : 'ordered'} {formatInstant(order.createdAt)}
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

      {/* The line itself: quantity large, price on the right. */}
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

