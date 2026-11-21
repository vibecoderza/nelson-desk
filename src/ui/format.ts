// How money and dates read on both surfaces. Money is integer cents, ZAR; time is stored UTC and shown SAST.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const grouped = (whole: number) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// R 17 535,00
export function rand(cents: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}R ${grouped(whole)}${opts.decimals === false ? "" : `,${rest}`}`;
}

export const count = (n: number) => grouped(n);

const sast = (d: Date) => new Date(d.getTime() + SAST_OFFSET_MS);

// 19 Nov
export function day(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const s = sast(typeof d === "string" ? new Date(d) : d);
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`;
}
// 19 Nov 2026
export const dayYear = (d: Date | string) => `${day(d)} ${sast(typeof d === "string" ? new Date(d) : d).getUTCFullYear()}`;
// 19 Nov 08:50
export function dayTime(d: Date): string {
  const s = sast(d);
  return `${day(d)} ${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}`;
}
// 2026-11-21, the SAST calendar date
export const isoDay = (d: Date) => sast(d).toISOString().slice(0, 10);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
