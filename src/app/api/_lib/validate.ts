/**
 * Lightweight validation helpers shared across all write-route handlers.
 * All functions are pure — no I/O, no side effects.
 */

/** UUID v4 pattern (case-insensitive) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** YYYY-MM-DD */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** HH:MM or HH:MM:SS — 24-hour clock */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Returns true when v is a valid UUID string */
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v);

/** Returns true when v is a valid YYYY-MM-DD calendar date */
export const isDateStr = (v: unknown): v is string =>
  typeof v === "string" &&
  DATE_RE.test(v) &&
  !isNaN(new Date(v).getTime());

/** Returns true when v is a valid HH:MM or HH:MM:SS time string */
export const isTimeStr = (v: unknown): v is string =>
  typeof v === "string" && TIME_RE.test(v);

/**
 * Returns true when the time string falls on a 15-minute boundary.
 * Assumes isTimeStr(t) is already true.
 */
export const is15MinAligned = (t: string): boolean =>
  parseInt(t.split(":")[1], 10) % 15 === 0;

/**
 * Returns true when time string `a` is strictly before `b`.
 * Comparison is lexicographic on HH:MM — valid because the format is
 * fixed-width with zero-padding.
 */
export const timeLt = (a: string, b: string): boolean =>
  a.slice(0, 5) < b.slice(0, 5);

/**
 * Returns the number of minutes between two HH:MM[:SS] strings.
 * Caller must ensure b > a.
 */
export const minutesBetween = (a: string, b: string): number => {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
};

/**
 * Parses an integer query-param value.
 * Returns the parsed number, or `fallback` if the param is absent or invalid.
 */
export const parseIntParam = (
  value: string | null,
  fallback: number
): number => {
  if (value === null) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
