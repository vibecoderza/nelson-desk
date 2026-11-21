// Suppliers. Desk only, start to finish: who makes what, what is with them now, and the costing requests out.
// On mock data the list and the requests are samples. A costing request carries no client name and no price.
import { isDone, type OrderFile } from "../orders/book.ts";
import { DESK_WORDS } from "../domain/order.ts";
import { day } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";
import { allSupply } from "./order-supply.ts";

const LINKED: Record<string, string> = { Amrod: "Prices by feed" };
type RequestIn = { id: string; supplier: string; for_ref: string; what: string; sentHoursAgo: number; answeredAfterHours: number | null };
const REQUESTS: RequestIn[] = [
  { id: "cr_1", supplier: "Barron", for_ref: "Q-00013", what: "Gift Set × 40 · laser engrave", sentHoursAgo: 20, answeredAfterHours: null },
  { id: "cr_2", supplier: "Headwear 24", for_ref: "Q-00009", what: "6 Panel Cap × 30 · front embroidery", sentHoursAgo: 230, answeredAfterHours: 19 },
];
const ANSWER_WINDOW_HOURS = 24; // a placeholder per supplier (brief 5.1); the Desk records the real time taken

export type SupplierRow = { name: string; how: string; with_them: { ref: string; what: string; state: string; their_ref: string | null }[]; requests_out: number };
export type CostingRequest = { id: string; supplier: string; for_ref: string; what: string; sent: string; chip: { tone: Tone; words: string } };
export type Suppliers = { rows: SupplierRow[]; requests: CostingRequest[] };

export async function suppliers(file: OrderFile, now: Date): Promise<Suppliers> {
  const orders = (await file.all()).filter((o) => !isDone(o));
  const supply = allSupply();
  const names = [...new Set([...Object.values(supply).map((s) => s.supplier), ...REQUESTS.map((r) => r.supplier)])];
  const rows = names.map((name) => ({
    name, how: LINKED[name] ?? "Costed by request",
    with_them: orders.filter((o) => supply[o.ref]?.supplier === name).map((o) => ({ ref: o.ref, what: o.title, state: DESK_WORDS[o.state], their_ref: supply[o.ref]!.supplier_order_ref })),
    requests_out: REQUESTS.filter((r) => r.supplier === name && r.answeredAfterHours === null).length,
  })).sort((a, b) => b.with_them.length - a.with_them.length || a.name.localeCompare(b.name));
  const requests = REQUESTS.map((r) => {
    const left = ANSWER_WINDOW_HOURS - r.sentHoursAgo;
    const chip: CostingRequest["chip"] = r.answeredAfterHours !== null ? { tone: "ok", words: `Answered in ${r.answeredAfterHours} h` } : left > 0 ? { tone: "warn", words: `Answer due in ${left} h` } : { tone: "bad", words: "Answer overdue" };
    return { id: r.id, supplier: r.supplier, for_ref: r.for_ref, what: r.what, sent: day(new Date(now.getTime() - r.sentHoursAgo * 3_600_000)), chip };
  });
  return { rows, requests };
}
