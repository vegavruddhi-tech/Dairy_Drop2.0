'use client';

/**
 * Interactive primitives.
 *
 * Separated from the server components in `index.jsx` so the static pieces of a
 * page ship no JavaScript at all. These are the only components in the design
 * system that carry a bundle cost.
 */

import { useFormStatus } from 'react-dom';
import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';

import { cn } from './index.jsx';

// ── Buttons ──────────────────────────────────────────────────────────────────

/**
 * Button treatments from the original apps: heavier weight than a default,
 * a generous radius, and a small lift on hover for the filled variants.
 */
const VARIANTS = {
  primary:
    'bg-brand text-brand-ink shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:transform-none',
  secondary: 'bg-surface-muted text-ink hover:bg-border disabled:opacity-50',
  outline:
    'border border-border bg-surface text-ink shadow-xs hover:bg-surface-muted hover:shadow-sm disabled:opacity-50',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-50',
  danger:
    'bg-critical text-white shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:transform-none',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/**
 * A submit button that knows whether its own form is in flight.
 * No manual `isSubmitting` state anywhere in the app.
 */
export function SubmitButton({ children, ...props }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

export function Spinner({ className }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Run a Server Action from a button, surfacing the result as a toast.
 *
 * Centralising this means no call site has to remember to handle `ok: false`,
 * which is how inconsistent error handling creeps in.
 */
export function ActionButton({
  action,
  payload,
  confirm,
  successMessage,
  children,
  onDone,
  ...props
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;

    startTransition(async () => {
      const result = await action(payload);
      if (result?.ok) {
        if (successMessage) toast.success(successMessage);
        onDone?.(result.data);
      } else {
        toast.error(result?.message ?? 'Something went wrong.');
      }
    });
  }

  return (
    <Button onClick={run} loading={pending} {...props}>
      {children}
    </Button>
  );
}

// ── Form fields ──────────────────────────────────────────────────────────────
 
export function Input({ label, hint, error, className, id, ...props }) {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          'h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-ink shadow-xs transition-all',
          'placeholder:text-ink-subtle placeholder:font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
          error ? 'border-critical focus:border-critical focus:ring-critical/20' : '',
          className,
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Select({ label, options, error, className, id, ...props }) {
  const selectId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          'h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-ink shadow-xs transition-all',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
          error ? 'border-critical focus:border-critical focus:ring-critical/20' : '',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs font-medium text-critical">{error}</p> : null}
    </div>
  );
}

export function Textarea({ label, error, className, id, ...props }) {
  const textareaId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={textareaId} className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        rows={3}
        className={cn(
          'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-medium text-ink shadow-sm transition-all',
          'placeholder:text-ink-subtle placeholder:font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
          error ? 'border-critical focus:border-critical focus:ring-critical/20' : '',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs font-medium text-critical">{error}</p> : null}
    </div>
  );
}

/**
 * A stepper for litres.
 *
 * Big tap targets first: the milkman is using this outdoors, one-handed, and
 * 0.5 L steps cover almost every real adjustment. The number itself is also
 * editable, because "tap targets are enough" was not true — anything off the
 * step grid was unreachable, and a customer who wanted 2.5 L from a 2 L plan
 * had to find a small `+` on a phone. Typing is the reliable path; the buttons
 * are the fast one.
 */
export function QuantityStepper({ name, defaultValue = 1, step = 0.5, min = 0.5, max = 20, unit = 'L' }) {
  const [value, setValue] = useState(Number(defaultValue));
  /*
   * The number is typeable, not only tappable.
   *
   * With buttons alone, 2.5 from a plan of 2 meant finding a small `+` on a
   * phone, and anything not a multiple of `step` was unreachable. Held as text
   * while editing so an in-progress "2." is not clamped to 2 mid-keystroke.
   */
  const [draft, setDraft] = useState(null);

  const clamp = (next) => Math.min(max, Math.max(min, Math.round(next * 1000) / 1000));

  function commitDraft() {
    const parsed = Number(draft);
    setValue(draft !== null && draft !== '' && Number.isFinite(parsed) ? clamp(parsed) : value);
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { commitDraft(); setValue((v) => clamp(v - step)); }}
        aria-label={`Decrease by ${step} ${unit}`}
        className="w-11"
      >
        −
      </Button>
      <div className="flex min-w-[5rem] items-baseline justify-center">
        <input
          type="text"
          inputMode="decimal"
          aria-label={`Quantity in ${unit}`}
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
            }
          }}
          className="stat-number w-16 bg-transparent text-center text-2xl text-ink outline-none focus:underline"
        />
        <span className="ml-1 text-sm text-ink-muted">{unit}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { commitDraft(); setValue((v) => clamp(v + step)); }}
        aria-label={`Increase by ${step} ${unit}`}
        className="w-11"
      >
        +
      </Button>
      {/* Always the committed number, never a half-typed draft. */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

// ── Disclosure ───────────────────────────────────────────────────────────────

/**
 * A modal built on the native `<dialog>` element, so focus trapping, Escape and
 * the backdrop come from the platform rather than from a library.
 */
export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {/*
        A column bounded by the viewport, with only the middle section
        scrolling.

        Without the bound the panel simply grew past the screen: a long form
        pushed its own title off the top and its Save button off the bottom,
        with nothing to scroll because the panel was the same height as its
        contents. Pinning the header and footer keeps the action reachable
        however long the form gets.

        `dvh` rather than `vh` because mobile browser chrome collapses as you
        scroll, and `vh` measures the taller state — the footer would sit just
        below the fold.
      */}
      <div className="flex max-h-[100dvh] w-full max-w-md flex-col animate-fade-up rounded-t-2xl border border-border bg-surface shadow-lifted sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-subtle hover:bg-surface-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {/* `overscroll-contain` stops a flick at the end of the list from
            scrolling the page behind the sheet. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Segmented tabs that keep their state in the URL, so a refresh preserves it. */
export function TabLinks({ tabs, current, basePath }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1" aria-label="Sections">
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <a
            key={tab.value}
            href={`${basePath}?tab=${tab.value}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'tap flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-[13px] font-bold transition-all',
              active
                ? 'bg-surface text-brand shadow-card'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="ml-1.5 rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {tab.count}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
