// What the Portal's order screens show. Every view is one client's own orders and passes the exposure walk before
// it is returned. Someone else's order and an order that does not exist look the same from outside.
import { assertPortalSafe } from "../exposure/private.ts";
import { PORTAL_WORDS, type OrderState } from "../domain/order.ts";
import { PROOF_CHECKS, type ProofCheck, type ProofState, type SignerRole } from "../domain/proof.ts";
import { isDone, targetDate, type FiledOrder, type OrderFile } from "../orders/book.ts";
import { ORDER_TONE, steps, type Step } from "../orders/words.ts";
import type { BookMessage, QuoteBook } from "../quotes/book.ts";
import { day } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";

export type PortalOrderTab = "open" | "done";
type Next = { label: string; href: string };
export type PortalOrderRow = { ref: string; title: string; picture: string | null; tiles: string[]; chip: { tone: Tone; words: string }; when: string; next: Next | null };
export type PortalOrders = { client_name: string; tab: PortalOrderTab; counts: Record<PortalOrderTab, number>; rows: PortalOrderRow[] };

const toSign = (o: FiledOrder) => o.state === "proof_with_client" && !o.hold;
const whenWords = (o: FiledOrder, now: Date) =>
  o.state === "cancelled" ? "Cancelled" : o.state === "delivered" ? `Delivered ${day(targetDate(o, now))}` : o.hold ? "On hold" : `Arriving ${day(targetDate(o, now))}`;
const chipOf = (o: FiledOrder): PortalOrderRow["chip"] =>
  o.hold ? { tone: "bad", words: "On hold" } : toSign(o) ? { tone: "warn", words: "Proof ready to sign" } : { tone: ORDER_TONE[o.state], words: PORTAL_WORDS[o.state] };
const nextOf = (o: FiledOrder): Next | null =>
  toSign(o) ? { label: "Sign the proof", href: `/orders/${o.ref}/proof` } : null;

function orderRow(o: FiledOrder, now: Date): PortalOrderRow {
  return { ref: o.ref, title: o.title, picture: o.lines.find((l) => l.picture)?.picture ?? null, tiles: o.lines.slice(0, 3).map((l) => l.colour_hex), chip: chipOf(o), when: whenWords(o, now), next: nextOf(o) };
}

export async function portalOrders(file: OrderFile, clientId: string, tab: PortalOrderTab, now: Date): Promise<PortalOrders | null> {
  const orders = await file.forClient(clientId);
  const name = orders[0]?.client.name;
  if (!name) return null;
  const tabOf = (o: FiledOrder): PortalOrderTab => (isDone(o) ? "done" : "open");
  const counts = { open: orders.filter((o) => !isDone(o)).length, done: orders.filter(isDone).length };
  const rows = orders.filter((o) => tabOf(o) === tab).sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime()).map((o) => orderRow(o, now));
  return assertPortalSafe({ client_name: name, tab, counts, rows }, "the Portal's order list");
}

export type PortalOrder = {
  client_name: string; ref: string; title: string; state: OrderState; chip: { tone: Tone; words: string }; steps: Step[];
  lead: { label: string; words: string; note: string }; next: Next | null;
  lines: { id: string; name: string; colour: string; colour_hex: string; picture: string | null; quantity: number; decoration_words: string }[];
  total_cents: number; paid: string; quote_ref: string | null;
  tracking: { waybill: string; service: string; steps: { at: Date; words: string }[] } | null;
  log: { at: Date; words: string }[]; messages: BookMessage[]; can_ask: boolean; proof_signed: boolean;
};

function leadOf(o: FiledOrder, now: Date): PortalOrder["lead"] {
  const date = day(targetDate(o, now));
  if (o.state === "cancelled") return { label: "Cancelled", words: "Not going ahead", note: "" };
  if (o.state === "delivered") return { label: "Delivered", words: date, note: "" };
  if (o.hold) return { label: "On hold", words: "We need a word", note: o.hold.reason };
  if (!o.proof.signed) return { label: "Arriving", words: date, note: toSign(o) ? "If you sign the proof today. Each day later moves it one working day." : "Counted from the day you sign the proof." };
  return { label: "Arriving", words: date, note: o.state === "dispatched" ? "On the road." : "On track." };
}

export async function portalOrder(file: OrderFile, clientId: string, ref: string, now: Date): Promise<PortalOrder | null> {
  const o = await file.byRef(ref);
  if (!o || o.client.id !== clientId) return null;
  return assertPortalSafe({
    client_name: o.client.name, ref: o.ref, title: o.title, state: o.state, chip: chipOf(o), steps: o.state === "cancelled" ? [] : steps(o.state), lead: leadOf(o, now), next: nextOf(o),
    lines: o.lines.map((l) => ({ id: l.id, name: l.product_name, colour: l.colour, colour_hex: l.colour_hex, picture: l.picture, quantity: l.quantity, decoration_words: l.decoration_words })),
    total_cents: o.total_cents, paid: day(o.paid_at), quote_ref: o.quote_ref,
    tracking: o.shipment ? { waybill: o.shipment.waybill, service: o.shipment.service, steps: [...o.shipment.steps].reverse() } : null,
    log: [...o.log].reverse(), messages: o.messages, can_ask: !isDone(o), proof_signed: o.proof.signed !== null,
  }, `the Portal's order ${ref}`);
}

// The proof. The words here are the words the evidence record keeps, exactly as the client saw them.
export const CHECK_WORDS: Record<ProofCheck, string> = {
  spelling: "The spelling is right",
  colours: "The colours are right",
  size_and_position: "The size and position are right",
  this_is_what_gets_made: "This is what gets made",
};
export const PROOF_STATEMENT = "I approve this proof for production.";

export type PortalProof = {
  client_name: string; order_ref: string; proof_ref: string; title: string; round: number; state: ProofState; can_sign: boolean; may_sign: boolean;
  sheet_picture: string | null; sheet_sha256: string | null; arriving: string;
  lines: { name: string; colour: string; quantity: number; decoration_words: string }[];
  checks: { value: ProofCheck; words: string }[]; statement: string; signed: { name: string; on: string } | null;
};

export async function portalProof(file: OrderFile, clientId: string, ref: string, role: SignerRole, now: Date): Promise<PortalProof | null> {
  const o = await file.byRef(ref);
  // A proof Nelson has not sent yet is Nelson's.
  if (!o || o.client.id !== clientId || (o.proof.state !== "with_client" && o.proof.state !== "signed")) return null;
  return assertPortalSafe({
    client_name: o.client.name, order_ref: o.ref, proof_ref: o.proof.ref, title: o.title, round: o.proof.round, state: o.proof.state,
    can_sign: toSign(o), may_sign: role === "owner", sheet_picture: o.proof.sheet_picture, sheet_sha256: o.proof.sheet_sha256, arriving: day(targetDate(o, now)),
    lines: o.lines.map((l) => ({ name: l.product_name, colour: l.colour, quantity: l.quantity, decoration_words: l.decoration_words })),
    checks: PROOF_CHECKS.map((value) => ({ value, words: CHECK_WORDS[value] })), statement: PROOF_STATEMENT,
    signed: o.proof.signed ? { name: o.proof.signed.name, on: day(o.proof.signed.at) } : null,
  }, `the Portal's proof for ${ref}`);
}

// Home: what needs the client, then what is on its way. Nothing else.
export type HomeRow = { key: string; href: string; title: string; sub: string; picture: string | null; tiles: string[]; chip: { tone: Tone; words: string }; next: Next | null };
export type PortalHome = { client_name: string; needs: HomeRow[]; moving: HomeRow[] };

export async function portalHome(quotes: QuoteBook, file: OrderFile, clientId: string, now: Date): Promise<PortalHome | null> {
  const [mine, orders] = await Promise.all([quotes.forClient(clientId), file.forClient(clientId)]);
  const name = mine[0]?.client.name ?? orders[0]?.client.name;
  if (!name) return null;
  const orderRows = orders.filter((o) => !isDone(o)).map((o) => ({ o, row: orderRow(o, now) }));
  const asHome = ({ o, row }: (typeof orderRows)[number]): HomeRow => ({ key: o.ref, href: `/orders/${o.ref}`, title: row.title, sub: `${o.ref} · ${row.when}`, picture: row.picture, tiles: row.tiles, chip: row.chip, next: row.next });
  const quoteRows: HomeRow[] = mine.filter((q) => q.versions.length > 0 && (q.state === "final" || (q.state === "working" && q.lines.some((l) => l.state === "nelson_suggests")))).map((q) => ({
    key: q.ref, href: `/quotes/${q.ref}`, title: q.title, sub: q.ref, picture: q.lines.find((l) => l.picture)?.picture ?? null, tiles: q.lines.slice(0, 3).map((l) => l.colour_hex),
    chip: q.state === "final" ? { tone: "ok", words: "Ready to accept and pay" } : { tone: "bad", words: "A suggestion for you" },
    next: q.state === "final" ? { label: "Accept and pay", href: `/quotes/${q.ref}/decide` } : { label: "Open", href: `/quotes/${q.ref}` },
  }));
  return assertPortalSafe({
    client_name: name,
    needs: [...orderRows.filter((x) => x.row.next || x.o.hold).map(asHome), ...quoteRows],
    moving: orderRows.filter((x) => !x.row.next && !x.o.hold).map(asHome),
  }, "the Portal's home");
}

export async function portalCounts(quotes: QuoteBook, file: OrderFile, clientId: string): Promise<{ quotes: number; orders: number }> {
  const [mine, orders] = await Promise.all([quotes.forClient(clientId), file.forClient(clientId)]);
  return { quotes: mine.filter((q) => q.state === "working" || q.state === "final").length, orders: orders.filter((o) => !isDone(o)).length };
}
