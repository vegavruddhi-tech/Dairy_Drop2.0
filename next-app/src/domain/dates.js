/**
 * Business dates.
 *
 * Every delivery day and billing month resolves in APP_TIMEZONE (Asia/Kolkata by
 * default), never UTC. This is not a nicety: between 00:00 and 05:30 IST,
 * `new Date().toISOString().slice(0, 10)` returns *yesterday*, and the milkman's
 * round starts at 05:00. The previous system had a correct helper and then used
 * `toISOString()` directly in roughly forty other places, so the customer app and
 * the milkman app disagreed about what day it was for five and a half hours every
 * night.
 *
 * The rule here: **no other module may construct a date string.** Everything goes
 * through this file.
 *
 * Pure module — no I/O.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

export const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Current business date and month
// ─────────────────────────────────────────────────────────────────────────────

/** Today in the business timezone, as 'YYYY-MM-DD'. */
export function businessDate(instant = new Date()) {
  return formatInTimeZone(instant, TIMEZONE, 'yyyy-MM-dd');
}

/** The current business month, as 'YYYY-MM'. */
export function businessMonth(instant = new Date()) {
  return formatInTimeZone(instant, TIMEZONE, 'yyyy-MM');
}

/** The business month a date string belongs to. */
export function monthOf(date) {
  assertDate(date);
  return date.slice(0, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// Month arithmetic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True number of days in a month — 28, 29, 30 or 31.
 *
 * Billing divides a monthly price by this. The old milkman-side code divided by
 * a hardcoded 30, which is why a milkman's revenue never matched the sum of
 * their customers' bills in any month that was not 30 days long.
 */
export function daysInMonth(month) {
  assertMonth(month);
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** First day of a month, as 'YYYY-MM-DD'. */
export function monthStart(month) {
  assertMonth(month);
  return `${month}-01`;
}

/** Last day of a month, as 'YYYY-MM-DD'. */
export function monthEnd(month) {
  assertMonth(month);
  return `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
}

/**
 * First day of the *next* month.
 *
 * Range queries use the half-open interval `[monthStart, nextMonthStart)`. The
 * old code used a closed `<= 'YYYY-MM-31'` against a `timestamptz` column, which
 * coerced to midnight and silently dropped every order placed on the last day of
 * the month.
 */
export function nextMonthStart(month) {
  assertMonth(month);
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
}

/** Shift a month by `delta` months. `addMonths('2026-01', -1) === '2025-12'`. */
export function addMonths(month, delta) {
  assertMonth(month);
  const [year, monthNumber] = month.split('-').map(Number);
  const zeroBased = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(zeroBased / 12)}-${String((zeroBased % 12) + 1).padStart(2, '0')}`;
}

/** The `count` most recent months ending at `month`, newest first. */
export function recentMonths(month, count) {
  return Array.from({ length: count }, (_, i) => addMonths(month, -i));
}

// ─────────────────────────────────────────────────────────────────────────────
// Day arithmetic
// ─────────────────────────────────────────────────────────────────────────────

/** Shift a business date by whole days. Safe across DST and month ends. */
export function addDays(date, delta) {
  assertDate(date);
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + delta));
  return shifted.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from, to) {
  assertDate(from);
  assertDate(to);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from, to) {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(from, i));
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date) {
  assertDate(date);
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Day of month, 1–31. */
export function dayOfMonth(date) {
  assertDate(date);
  return Number(date.slice(8, 10));
}

export function isBefore(a, b) {
  return a < b;
}
export function isAfter(a, b) {
  return a > b;
}
export function isWithin(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}
export function minDate(a, b) {
  return a < b ? a : b;
}
export function maxDate(a, b) {
  return a > b ? a : b;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instants
// ─────────────────────────────────────────────────────────────────────────────

/** Midnight at the start of a business date, as a UTC `Date`. */
export function startOfBusinessDay(date) {
  assertDate(date);
  return fromZonedTime(`${date}T00:00:00`, TIMEZONE);
}

/** The last representable instant of a business date, as a UTC `Date`. */
export function endOfBusinessDay(date) {
  assertDate(date);
  return fromZonedTime(`${date}T23:59:59.999`, TIMEZONE);
}

/** A `Date` rendered in business-local time — for logs and admin screens. */
export function toBusinessTime(instant) {
  return toZonedTime(instant, TIMEZONE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentation
// ─────────────────────────────────────────────────────────────────────────────

/** '2026-09-22' → '22 Sep 2026'. */
export function formatDate(date) {
  assertDate(date);
  return formatInTimeZone(startOfBusinessDay(date), TIMEZONE, 'd MMM yyyy');
}

/** '2026-09-22' → 'Tue, 22 Sep'. */
export function formatDateShort(date) {
  assertDate(date);
  return formatInTimeZone(startOfBusinessDay(date), TIMEZONE, 'EEE, d MMM');
}

/** '2026-09' → 'September 2026'. */
export function formatMonth(month) {
  assertMonth(month);
  return formatInTimeZone(startOfBusinessDay(monthStart(month)), TIMEZONE, 'MMMM yyyy');
}

/** A timestamp in business-local time: '22 Sep 2026, 6:05 am'. */
export function formatInstant(instant) {
  if (!instant) return '';
  return formatInTimeZone(new Date(instant), TIMEZONE, "d MMM yyyy, h:mm a");
}

/** 'Good morning' / 'Good afternoon' / 'Good evening', in business-local time. */
export function greeting(instant = new Date()) {
  const hour = Number(formatInTimeZone(instant, TIMEZONE, 'H'));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery windows
// ─────────────────────────────────────────────────────────────────────────────

const ISO_TIME = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/** Is this a wall-clock time this module will accept? */
export function isClockTime(value) {
  return typeof value === 'string' && ISO_TIME.test(value.trim());
}

/**
 * '06:00' or '06:00:00' → '6:00 am'.
 *
 * A plain wall-clock time, not an instant: it is 6 am in APP_TIMEZONE whatever
 * the date, so it is formatted directly rather than pushed through a timezone
 * conversion that would shift it.
 */
export function formatClockTime(value) {
  if (!isClockTime(value)) return '';
  const [hourText, minuteText] = value.trim().split(':');
  const hour = Number(hourText);
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minuteText} ${suffix}`;
}

/**
 * The wall-clock time right now in the business timezone, as 'HH:MM'.
 *
 * Comparable against a stored window with a plain string compare, which is why
 * both are zero-padded 24-hour.
 */
export function businessClockNow(instant = new Date()) {
  return formatInTimeZone(instant, TIMEZONE, 'HH:mm');
}

/**
 * A delivery window, as the customer reads it: '6:00 – 7:30 am'.
 *
 * The meridiem is printed once when both ends share it, which is the common
 * case and how a person would say it out loud. Returns '' when the window is
 * not set, so a caller can fall back to the bare slot name.
 */
export function formatWindow(start, end) {
  if (!isClockTime(start) || !isClockTime(end)) return '';

  const from = formatClockTime(start);
  const to = formatClockTime(end);
  const [fromTime, fromSuffix] = from.split(' ');
  const [, toSuffix] = to.split(' ');

  return fromSuffix === toSuffix ? `${fromTime} – ${to}` : `${from} – ${to}`;
}

// ─────────────────────────────────────────────────────────────────────────────

function assertDate(value) {
  if (!ISO_DATE.test(value)) {
    throw new TypeError(`Expected a business date 'YYYY-MM-DD', got ${JSON.stringify(value)}`);
  }
}

function assertMonth(value) {
  if (!ISO_MONTH.test(value)) {
    throw new TypeError(`Expected a business month 'YYYY-MM', got ${JSON.stringify(value)}`);
  }
}

export { assertDate, assertMonth };
