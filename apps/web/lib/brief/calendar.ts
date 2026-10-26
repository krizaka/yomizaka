/**
 * Calendar days as « YYYY-MM-DD » strings, in whole days and whole months — the arithmetic a notice window needs, with no clock and
 * no time zone: the day is the one written on the lease. A month count clamps to the month's last day (6 months before
 * 2027-08-31 is 2027-02-28), leap years included.
 */
export interface Day {
  y: number;
  m: number;
  d: number;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDay(text: string): Day | null {
  const match = DAY.exec(text);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? { y, m, d } : null;
}

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
export const formatDay = ({ y, m, d }: Day): string => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** The day `months` months later (negative: earlier), clamped to the last day of the month it lands in. */
export function addMonths(day: Day, months: number): Day {
  const total = day.y * 12 + (day.m - 1) + months;
  const [y, m] = [Math.floor(total / 12), (((total % 12) + 12) % 12) + 1];
  return { y, m, d: Math.min(day.d, daysInMonth(y, m)) };
}

/** Days since 1970-01-01 (Howard Hinnant's civil-days algorithm): whole days only, no instant, no time zone. */
export function epochDay({ y, m, d }: Day): number {
  const year = m <= 2 ? y - 1 : y;
  const era = Math.floor(year / 400);
  const yoe = year - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: Day, to: Day): number => epochDay(to) - epochDay(from);

export const addDays = (day: Day, days: number): Day => {
  // Walk from the epoch day back to a civil day (the inverse of `epochDay`).
  const z = epochDay(day) + days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
};
