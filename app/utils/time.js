import { DateTime } from 'luxon';

/**
 * Format a database timestamp as a relative Indonesian time.
 *
 * @param {string | number | Date | null | undefined} value
 * @param {string} [fallback='-']
 * @returns {string}
 */
export function formatRelativeTime(value, fallback = '-') {
  if (!value) return fallback;

  const dt =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: 'utc' })
      : typeof value === 'number'
        ? DateTime.fromMillis(value, { zone: 'utc' })
        : DateTime.fromSQL(String(value), { zone: 'utc' });

  if (!dt.isValid) return fallback;
  return dt.setLocale('id').toRelative() || dt.toFormat('dd LLL yyyy') || fallback;
}
