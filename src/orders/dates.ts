// Working days (brief 3.3). Weekends and South African public holidays do not count. This is a calendar, not a
// price: the lead times it counts with are Nelson's answer, held on the order.
const DAY = 86_400_000;
const SAST = 2 * 3_600_000;

// Public holidays as observed, Sunday ones on the Monday. Add each year as the government gazettes it.
const HOLIDAYS = new Set([
  "2026-01-01", "2026-03-21", "2026-04-03", "2026-04-06", "2026-04-27", "2026-05-01", "2026-06-16", "2026-08-10", "2026-09-24", "2026-12-16", "2026-12-25", "2026-12-26",
  "2027-01-01", "2027-03-22", "2027-03-26", "2027-03-29", "2027-04-27", "2027-05-01", "2027-06-16", "2027-08-09", "2027-09-24", "2027-12-16", "2027-12-25", "2027-12-27",
]);

const sastDay = (d: Date) => new Date(d.getTime() + SAST).toISOString().slice(0, 10);
export function isWorkingDay(d: Date): boolean {
  const weekday = new Date(d.getTime() + SAST).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(sastDay(d));
}

export function addWorkingDays(from: Date, days: number): Date {
  let at = from;
  for (let left = days; left > 0; ) {
    at = new Date(at.getTime() + DAY);
    if (isWorkingDay(at)) left -= 1;
  }
  return at;
}

// Whole SAST calendar days from a to b. Negative when b is before a.
export const daysBetween = (a: Date, b: Date): number => Math.round((Date.parse(sastDay(b)) - Date.parse(sastDay(a))) / DAY);
