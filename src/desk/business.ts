// Business: the numbers, counted from paid orders and quotes on file. Desk only. Sums and counts, nothing priced.
// Cost of goods, gross profit and margin are Nelson's answer per order and join when the order packs carry them;
// unpaid invoices join with Xero.
import { isDone, type OrderFile } from "../orders/book.ts";
import { latestVersion, type QuoteBook } from "../quotes/book.ts";
import { day } from "../ui/format.ts";

const SAST = 2 * 3_600_000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthKey = (d: Date) => new Date(d.getTime() + SAST).toISOString().slice(0, 7);
const monthWord = (key: string) => MONTHS[Number(key.slice(5)) - 1]!;

export type Business = {
  month: string; sales_cents: number; orders: number; average_cents: number | null; open_cents: number; out_on_quote_cents: number; won: number; decided: number;
  by_month: { month: string; sales_cents: number }[];
  paid: { ref: string; client: string; what: string; on: string; total_cents: number }[];
};

export async function business(book: QuoteBook, file: OrderFile, now: Date): Promise<Business> {
  const orders = (await file.all()).filter((o) => o.state !== "cancelled").sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime());
  const quotes = await book.all();
  const sum = (xs: { total_cents: number }[]) => xs.reduce((s, x) => s + x.total_cents, 0);
  const thisMonth = orders.filter((o) => monthKey(o.paid_at) === monthKey(now));
  const months = [...new Set(orders.map((o) => monthKey(o.paid_at)))].sort().slice(-6);
  const decided = quotes.filter((q) => q.state === "accepted" || q.state === "declined" || q.state === "expired");
  return {
    month: monthWord(monthKey(now)), sales_cents: sum(thisMonth), orders: thisMonth.length, average_cents: thisMonth.length ? Math.round(sum(thisMonth) / thisMonth.length) : null,
    open_cents: sum(orders.filter((o) => !isDone(o))),
    out_on_quote_cents: quotes.filter((q) => q.state === "working" || q.state === "final").reduce((s, q) => s + (latestVersion(q)?.totals.total_cents ?? 0), 0),
    won: decided.filter((q) => q.state === "accepted").length, decided: decided.length,
    by_month: months.map((key) => ({ month: monthWord(key), sales_cents: sum(orders.filter((o) => monthKey(o.paid_at) === key)) })),
    paid: orders.map((o) => ({ ref: o.ref, client: o.client.name, what: o.title, on: day(o.paid_at), total_cents: o.total_cents })),
  };
}
