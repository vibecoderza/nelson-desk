// The Inbox: one row per conversation, every channel, the ones waiting on us first and oldest at the top.
// Desk only. "Read" is what the agent took from a message: a suggestion beside the words, never a price. Nothing
// prices until a quote is opened and Nelson is asked.
import type { FiledOrder, OrderFile } from "../orders/book.ts";
import type { BookMessage, BookQuote, QuoteBook } from "../quotes/book.ts";
import { CLIENTS } from "../mock/book.ts";
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";

export type Inbound = { id: string; client_id: string | null; who: string; channel: BookMessage["channel"]; hoursAgo: number; text: string; read: string | null; artwork: boolean };

// Messages that belong to no quote or order yet: the enquiries. On mock data, three samples.
const SAMPLE: Inbound[] = [
  { id: "in_1", client_id: null, who: "New · WhatsApp ··· 3381", channel: "whatsapp", hoursAgo: 5, text: "Hi, saw you on Instagram. We need 80 branded caps for a golf day in Paarl, by 12 December. Logo attached.", read: "Caps × 80 · Paarl · by 12 Dec", artwork: true },
  { id: "in_2", client_id: CLIENTS.fynbos.id, who: CLIENTS.fynbos.name, channel: "whatsapp", hoursAgo: 2, text: "Hi Alan, can we add 20 more aprons, same olive? For the new Paarl shop.", read: "Canvas Apron × 20 · Olive", artwork: false },
  { id: "in_3", client_id: CLIENTS.brewing.id, who: CLIENTS.brewing.name, channel: "email", hoursAgo: 26, text: "Do the openers come individually bagged? And can you do a second run in January?", read: null, artwork: false },
];
export function inbound(): Inbound[] {
  if (mockBookInUse()) return SAMPLE;
  throw new NotBuiltYet("The message store");
}

export type InboxRow = {
  id: string; who: string; client_id: string | null; channel: string; at: Date; text: string; read: string | null; artwork: boolean; waiting: boolean;
  open: { label: string; href: string } | null; can_start: boolean;
};
export type Inbox = { waiting: InboxRow[]; answered: InboxRow[] };

export async function inbox(book: QuoteBook, file: OrderFile, now: Date, fresh: Inbound[] = inbound()): Promise<Inbox> {
  const rows: InboxRow[] = fresh.map((m) => ({
    id: m.id, who: m.who, client_id: m.client_id, channel: m.channel, at: new Date(now.getTime() - m.hoursAgo * 3_600_000), text: m.text, read: m.read, artwork: m.artwork, waiting: true,
    open: m.client_id ? { label: "Reply", href: `/clients/${m.client_id}` } : null, can_start: m.read !== null,
  }));
  // A thread on a quote or an order: one row per job, showing its last message. It waits on us when they spoke last.
  const threads: { on: BookQuote | FiledOrder; href: string }[] = [
    ...(await book.all()).map((q) => ({ on: q, href: `/quotes/${q.ref}` })), ...(await file.all()).map((o) => ({ on: o, href: `/orders/${o.ref}` })),
  ];
  for (const { on, href } of threads) {
    const last = [...on.messages].sort((a, b) => a.at.getTime() - b.at.getTime()).at(-1);
    if (!last) continue;
    rows.push({
      id: on.ref, who: on.client.name, client_id: on.client.id, channel: last.channel, at: last.at, text: last.text, read: last.tag ? `${last.tag} · ${on.ref}` : on.ref, artwork: false,
      waiting: last.author === "client", open: { label: last.author === "client" ? "Answer" : "Open", href }, can_start: false,
    });
  }
  const oldestFirst = (a: InboxRow, b: InboxRow) => a.at.getTime() - b.at.getTime();
  return { waiting: rows.filter((r) => r.waiting).sort(oldestFirst), answered: rows.filter((r) => !r.waiting).sort((a, b) => -oldestFirst(a, b)) };
}
