import { requireMilkman } from '@/auth/session.js';
import { formatDate, formatDateShort, formatInstant } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import { getT, getLocale } from '@/i18n/server.js';
import * as productService from '@/services/product.service.js';

import { EmptyState, Card, CardBody, CardHeader, Table, Th, Td, Stat, SectionHeading, Badge, cn } from '@/components/ui/index.jsx';
import { OrdersIcon, CartIcon, CalendarIcon, MapPinIcon, PhoneIcon, CheckIcon, DeliveryIcon } from '@/components/ui/Icons.jsx';
import { OrdersListWithFilters } from '@/components/milkman/OrdersView.jsx';

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

      {/* ── Orders List With Real-Time Filters ───────────────────────── */}
      {open === 0 && history.length === 0 ? (
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
        <OrdersListWithFilters
          pending={pending}
          accepted={accepted}
          history={history}
          isHi={isHi}
        />
      )}
    </>
  );
}

