// What the Desk's client screens show: one client, and everything of theirs in one place. Desk only.
// The numbers are counts and sums of what is already on file. Nothing here prices anything.
import { isDone, type FiledOrder, type OrderFile } from "../orders/book.ts";
import type { BookClient, BookMessage, BookQuote, QuoteBook } from "../quotes/book.ts";
import { latestVersion } from "../quotes/book.ts";
import { boardRow, type BoardRow } from "./orders.ts";
import { pipelineRow, type PipelineRow } from "./quotes.ts";

const openQuote = (q: BookQuote) => q.state === "draft" || q.state === "working" || q.state === "final";
const CLIENT_ID = /^c_[a-z0-9]{2,24}$/;

export type ClientRow = { id: string; name: string; contact: string; open_quotes: number; open_orders: number; paid_cents: number };
export type Clients = { rows: ClientRow[] };

function gather(quotes: BookQuote[], orders: FiledOrder[]): Map<string, { client: BookClient; quotes: BookQuote[]; orders: FiledOrder[] }> {
  const by = new Map<string, { client: BookClient; quotes: BookQuote[]; orders: FiledOrder[] }>();
  const of = (c: BookClient) => by.get(c.id) ?? by.set(c.id, { client: c, quotes: [], orders: [] }).get(c.id)!;
  for (const q of quotes) of(q.client).quotes.push(q);
  for (const o of orders) of(o.client).orders.push(o);
  return by;
}
const paid = (orders: FiledOrder[]) => orders.filter((o) => o.state !== "cancelled").reduce((sum, o) => sum + o.total_cents, 0);

export async function clients(book: QuoteBook, file: OrderFile): Promise<Clients> {
  const all = gather(await book.all(), await file.all());
  const rows = [...all.values()].map(({ client, quotes, orders }) => ({
    id: client.id, name: client.name, contact: client.contact_name, open_quotes: quotes.filter(openQuote).length, open_orders: orders.filter((o) => !isDone(o)).length, paid_cents: paid(orders),
  }));
  // Whoever has work open comes first; then by what they have spent.
  return { rows: rows.sort((a, b) => (b.open_orders + b.open_quotes) - (a.open_orders + a.open_quotes) || b.paid_cents - a.paid_cents || a.name.localeCompare(b.name)) };
}

// On a client's own page the client is known: the row leads with the job instead.
const titled = <T extends { client: string; what: string }>(row: T): T => ({ ...row, client: row.what, what: "" });

export type ClientPage = {
  id: string; name: string; contact: string; email: string; address: string; phone_tail: string;
  sendable: { ref: string; title: string }[]; // quotes that can be dropped into the conversation
  paid_cents: number; orders_count: number; average_order_cents: number | null; won: number; decided: number; open_quote_cents: number;
  orders: BoardRow[]; quotes: PipelineRow[]; messages: (BookMessage & { on: string })[];
};

export async function clientPage(book: QuoteBook, file: OrderFile, id: string, now: Date): Promise<ClientPage | null> {
  if (!CLIENT_ID.test(id)) return null;
  const found = gather(await book.all(), await file.all()).get(id);
  if (!found) return null;
  const { client, quotes, orders } = found;
  const counted = orders.filter((o) => o.state !== "cancelled");
  const decided = quotes.filter((q) => !openQuote(q));
  const byNewest = <T,>(xs: T[], at: (x: T) => number) => [...xs].sort((a, b) => at(b) - at(a));
  return {
    id: client.id, name: client.name, contact: client.contact_name, email: client.contact_email, address: client.address_words, phone_tail: client.phone_tail,
    sendable: quotes.filter((q) => (q.state === "working" || q.state === "final") && q.versions.length > 0).map((q) => ({ ref: q.ref, title: q.title })),
    paid_cents: paid(orders), orders_count: counted.length, average_order_cents: counted.length ? Math.round(paid(orders) / counted.length) : null,
    won: decided.filter((q) => q.state === "accepted").length, decided: decided.length,
    open_quote_cents: quotes.filter((q) => q.state === "working" || q.state === "final").reduce((sum, q) => sum + (latestVersion(q)?.totals.total_cents ?? 0), 0),
    orders: byNewest(orders, (o) => o.paid_at.getTime()).map((o) => boardRow(o, now)).map(titled),
    quotes: byNewest(quotes, (q) => (q.last_sent_at ?? q.asked_at).getTime()).map((q) => pipelineRow(q, now)).map(titled),
    messages: byNewest([...quotes.flatMap((q) => q.messages.map((m) => ({ ...m, on: q.ref }))), ...orders.flatMap((o) => o.messages.map((m) => ({ ...m, on: o.ref })))], (m) => -m.at.getTime()),
  };
}
