'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { cn, Badge, EmptyState, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { Button, Input, Modal } from '@/components/ui/interactive.jsx';
import { RoutesIcon, MapPinIcon, UsersIcon, TrashIcon, PlusIcon, CheckIcon } from '@/components/ui/Icons.jsx';
import { addServiceArea, deleteServiceArea } from '@/actions/milkman.actions.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * The delivery routes page: where the milkman delivers, in walking order.
 *
 * Adding and removing go through modals rather than an inline form and a
 * browser `confirm()`, so the list never jumps and a mis-tap on the bin has
 * one more step before a sector disappears from sign-ups.
 *
 * @param {object} props
 * @param {Array}  props.initialAreas
 * @param {Record<string, number>} [props.customerCounts] customers per pincode
 */
export function RoutesManager({ initialAreas = [], customerCounts = {} }) {
  const { t } = useT();
  const [areas, setAreas] = useState(initialAreas);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null); // the area awaiting confirmation
  const [pending, startTransition] = useTransition();

  const sorted = [...areas].sort(
    (a, b) => (a.routeSequence ?? 0) - (b.routeSequence ?? 0) || a.areaName.localeCompare(b.areaName),
  );
  const pincodes = new Set(sorted.map((area) => area.pincode));
  const covered = [...pincodes].reduce((total, pincode) => total + (customerCounts[pincode] ?? 0), 0);

  function handleAdd(data) {
    startTransition(async () => {
      const res = await addServiceArea(data);
      if (res.ok) {
        toast.success(`${data.areaName} (${data.pincode}) ${t('common.saved', {}, 'added.')}`);
        setAdding(false);
        setAreas((prev) => [...prev, res.data ?? data]);
      } else {
        toast.error(res.message ?? t('common.tryAgain', {}, 'Could not add that route.'));
      }
    });
  }

  function handleRemove(area) {
    startTransition(async () => {
      const res = await deleteServiceArea({ id: area.id });
      if (res.ok) {
        toast.success(`${area.areaName} ${t('common.delete', {}, 'removed.')}`);
        setAreas((prev) => prev.filter((a) => a.id !== area.id));
        setRemoving(null);
      } else {
        toast.error(res.message ?? t('common.tryAgain', {}, 'Could not remove that route.'));
      }
    });
  }

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
              {t('routes.coverage', {}, 'Coverage')}
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {t('routes.title', {}, 'Delivery routes')}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">
              {sorted.length === 0
                ? t('routes.noRoutesDesc', {}, 'Add the sectors you deliver to so households nearby can find you.')
                : `${sorted.length} ${sorted.length === 1 ? t('routes.sectors', {}, 'sector') : t('routes.sectors', {}, 'sectors')} · ${pincodes.size} ${pincodes.size === 1 ? t('routes.pincodes', {}, 'pincode') : t('routes.pincodes', {}, 'pincodes')} · ${t('routes.inWalkingOrder', {}, 'walked in this order.')}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
          >
            <PlusIcon className="h-4 w-4" />
            {t('routes.addRoute', {}, 'Add route')}
          </button>
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t('routes.sectors', {}, 'Sectors')} value={sorted.length} icon={<RoutesIcon className="h-5 w-5" />} tone="brand" />
        <Stat label={t('routes.pincodes', {}, 'Pincodes')} value={pincodes.size} icon={<MapPinIcon className="h-5 w-5" />} tone="info" />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label={t('routes.customersCovered', {}, 'Customers covered')}
            value={covered}
            icon={<UsersIcon className="h-5 w-5" />}
            tone="positive"
            hint={t('routes.withAddressInPincodes', {}, 'With an address in these pincodes')}
          />
        </div>
      </div>

      {/* ── The walk ──────────────────────────────────────────────────── */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<RoutesIcon className="h-8 w-8 text-brand" />}
          title={t('routes.noRoutesTitle', {}, 'No routes yet')}
          description={t('routes.noRoutesDesc', {}, 'Add your first sector and its pincode. Customers who sign up there will see your dairy and can subscribe.')}
          tip={t('routes.noRoutesTip', {}, 'Give each sector a route number in the order you ride it — the morning round is sorted by it.')}
          action={
            <Button onClick={() => setAdding(true)}>
              <PlusIcon className="h-4 w-4" />
              {t('routes.addFirstRoute', {}, 'Add first route')}
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="routes-heading">
          <SectionHeading id="routes-heading" count={sorted.length}>
            {t('routes.inWalkingOrder', {}, 'In walking order')}
          </SectionHeading>
          <ol className="grid gap-3 sm:grid-cols-2">
            {sorted.map((area, index) => (
              <RouteCard
                key={area.id ?? `${area.areaName}-${area.pincode}`}
                area={area}
                position={index + 1}
                customers={customerCounts[area.pincode] ?? 0}
                onRemove={() => setRemoving(area)}
              />
            ))}
          </ol>
        </section>
      )}

      <AddRouteModal
        open={adding}
        onClose={() => setAdding(false)}
        pending={pending}
        nextSequence={sorted.length ? Math.max(...sorted.map((a) => a.routeSequence ?? 0)) + 1 : 1}
        onSubmit={handleAdd}
      />

      {/* ── Remove, with one more step than a bin icon ────────────────── */}
      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? `${t('routes.removeRoute', {}, 'Remove')} ${removing.areaName}?` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>{t('routes.keepIt', {}, 'Keep it')}</Button>
            <Button variant="danger" loading={pending} onClick={() => removing && handleRemove(removing)}>
              {t('routes.removeRoute', {}, 'Remove route')}
            </Button>
          </>
        }
      >
        {removing ? (
          <div className="space-y-3 text-sm text-ink-muted">
            <p>
              New customers in <span className="font-bold text-ink">{removing.pincode}</span> will no longer
              find your dairy under <span className="font-bold text-ink">{removing.areaName}</span>.
            </p>
            {(customerCounts[removing.pincode] ?? 0) > 0 ? (
              <p className="rounded-xl border border-caution/25 bg-caution-soft px-3 py-2 text-xs font-semibold text-caution">
                {customerCounts[removing.pincode]} {t('routes.customers', {}, 'customers')} in this pincode.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/** One sector on the walk. */
function RouteCard({ area, position, customers, onRemove }) {
  const { t } = useT();
  return (
    <li className="card-surface flex items-start gap-3 p-4 transition-shadow hover:shadow-card-hover sm:p-5">
      {/* The stop number, as a numbered tile: this is a list you walk. */}
      <span
        aria-label={`Stop ${position}`}
        className="stat-number flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hero-gradient text-base text-brand-ink shadow-sm shadow-brand/25"
      >
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-heading text-base font-extrabold tracking-tight text-ink">{area.areaName}</h3>
          <span className="tnum rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-numeric text-[11px] font-bold text-ink-muted">
            {area.pincode}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <MapPinIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
          {[area.city, area.state].filter(Boolean).join(', ')}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge tone="positive" dot>{t('routes.liveForSignups', {}, 'Live for sign-ups')}</Badge>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted">
            <UsersIcon className="h-3.5 w-3.5 text-ink-subtle" />
            {customers} {customers === 1 ? t('routes.customer', {}, 'customer') : t('routes.customers', {}, 'customers')}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${area.areaName}`}
        title={t('routes.removeRoute', {}, 'Remove route')}
        className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-subtle shadow-xs transition-colors hover:border-critical/40 hover:bg-critical-soft hover:text-critical"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * The add form. Typing a six-digit pincode fills city and state from the
 * postal lookup, the same way the customer address editor does.
 */
function AddRouteModal({ open, onClose, pending, nextSequence, onSubmit }) {
  const { t } = useT();
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [looking, setLooking] = useState(false);

  // Reset when the sheet closes so the next open starts clean.
  useEffect(() => {
    if (open) return;
    setPincode('');
    setCity('');
    setState('');
    setSuggestions([]);
    setLooking(false);
  }, [open]);

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
      setSuggestions([]);
      return undefined;
    }
    let active = true;
    setLooking(true);
    fetch(`/api/pincode?pincode=${pincode}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.ok) {
          if (data.city) setCity(data.city);
          if (data.state) setState(data.state);
          setSuggestions(Array.isArray(data.areas) ? data.areas : []);
        }
      })
      .catch(() => {})
      .finally(() => active && setLooking(false));
    return () => {
      active = false;
    };
  }, [pincode]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('routes.addRouteTitle', {}, 'Add a delivery route')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', {}, 'Cancel')}</Button>
          <Button form="route-form" type="submit" loading={pending}>
            {pending ? null : <CheckIcon className="h-4 w-4" />}
            {t('routes.saveRoute', {}, 'Save route')}
          </Button>
        </>
      }
    >
      <form
        id="route-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSubmit({
            areaName: String(form.get('areaName') ?? '').trim(),
            pincode: String(form.get('pincode') ?? '').trim(),
            city: String(form.get('city') ?? '').trim(),
            state: String(form.get('state') ?? '').trim(),
            routeSequence: Number(form.get('routeSequence')) || 0,
          });
        }}
      >
        <p className="text-sm text-ink-muted">
          {t('routes.addRouteSubtitle', {}, 'Customers who sign up in this sector and pincode will see your dairy.')}
        </p>

        <Input
          name="pincode"
          label={t('routes.pincode', {}, 'Pincode')}
          inputMode="numeric"
          maxLength={6}
          pattern="\d{6}"
          placeholder={t('routes.pincodePlaceholder', {}, '6 digits, e.g. 122001')}
          required
          autoFocus
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          hint={looking ? t('routes.lookingUp', {}, 'Looking up city and state…') : city ? `${city}, ${state}` : undefined}
        />

        <div>
          <Input
            name="areaName"
            label={t('routes.sectorArea', {}, 'Sector / society / area')}
            placeholder={t('routes.sectorAreaPlaceholder', {}, 'e.g. Sector 59, Palm Heights')}
            required
            list="route-area-suggestions"
          />
          {suggestions.length > 0 ? (
            <datalist id="route-area-suggestions">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input name="city" label={t('routes.city', {}, 'City')} required value={city} onChange={(event) => setCity(event.target.value)} />
          <Input name="state" label={t('routes.state', {}, 'State')} required value={state} onChange={(event) => setState(event.target.value)} />
        </div>

        <Input
          name="routeSequence"
          type="number"
          label={t('routes.stopNumber', {}, 'Stop number on your round')}
          defaultValue={nextSequence}
          min="0"
          hint={t('routes.stopNumberHint', {}, 'Lower numbers are delivered first.')}
        />
      </form>
    </Modal>
  );
}
