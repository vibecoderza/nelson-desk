// What the Desk's order screens show. Desk only: the order page carries the supply side, which never leaves this
// folder. The board says one thing per order: what it is waiting on, and whose move it is.
import { DESK_WORDS, type OrderState } from "../domain/order.ts";
import { isDone, shipBy, targetDate, type FiledOrder, type OrderFile } from "../orders/book.ts";
import { daysBetween } from "../orders/dates.ts";
import { ORDER_TONE, steps, type Step } from "../orders/words.ts";
import type { BookMessage } from "../quotes/book.ts";
import { day } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";
import { supplyFor, type Supply } from "./order-supply.ts";

export type BoardTab = "open" | "done";
export type BoardGroup = "needs_you" | "with_client" | "in_the_works" | "on_the_road";
export type Move = "wait_sheet" | "check_proof" | "wait_client" | "place_order" | "wait_production" | "waybill" | "on_road" | "held" | "done";
export type BoardRow = {
  ref: string; client: string; what: string; total_cents: number; target: string; late: boolean; group: BoardGroup; move: Move;
  chip: { tone: Tone; words: string }; action: { label: string; next: boolean; place: boolean };
};
export type Board = { tab: BoardTab; counts: Record<BoardTab, number>; needs_you: number; groups: { key: BoardGroup; title: string; rows: BoardRow[] }[]; flat: BoardRow[] };

export function moveOf(o: FiledOrder, now: Date): Move {
  if (isDone(o)) return "done";
  if (o.hold) return "held";
  const due = shipBy(o);
  const by: Record<Exclude<OrderState, "delivered" | "cancelled">, Move> = {
    paid: "wait_sheet", proof_with_nelson: "check_proof", proof_with_client: "wait_client", signed: "place_order",
    in_production: due && daysBetween(now, due) <= 0 ? "waybill" : "wait_production", dispatched: "on_road",
  };
  return by[o.state as keyof typeof by];
}

const agoWord = (n: number) => (n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);

function boardRow(o: FiledOrder, now: Date): BoardRow {
  const move = moveOf(o, now);
  const target = targetDate(o, now);
  const late = !isDone(o) && o.proof.signed !== null && target !== null && daysBetween(now, target) < 0;
  const open = { label: "Open", next: false, place: false };
  const by: Record<Move, Pick<BoardRow, "group" | "chip" | "action">> = {
    held: { group: "needs_you", chip: { tone: "bad", words: "On hold" }, action: open },
    check_proof: { group: "needs_you", chip: { tone: "warn", words: "Proof to check" }, action: { label: "Check proof", next: true, place: false } },
    place_order: { group: "needs_you", chip: { tone: "warn", words: "Signed · place the order" }, action: { label: "Place order", next: true, place: true } },
    waybill: { group: "needs_you", chip: { tone: late ? "bad" : "warn", words: "Enter the waybill" }, action: { label: "Enter waybill", next: true, place: false } },
    wait_client: { group: "with_client", chip: { tone: o.proof.sent_at && daysBetween(o.proof.sent_at, now) > 0 ? "warn" : "plain", words: `Proof out ${agoWord(o.proof.sent_at ? daysBetween(o.proof.sent_at, now) : 0)} · not signed` }, action: open },
    wait_sheet: { group: "in_the_works", chip: { tone: "plain", words: "Waiting on the proof sheet" }, action: open },
    wait_production: { group: "in_the_works", chip: { tone: "plain", words: `In production · ships ${day(shipBy(o))}` }, action: open },
    on_road: { group: "on_the_road", chip: { tone: "ok", words: `Dispatched ${day(o.shipment?.sent_at)}` }, action: open },
    done: { group: "on_the_road", chip: { tone: ORDER_TONE[o.state], words: o.state === "cancelled" ? "Cancelled" : `Delivered ${day(target)}` }, action: open },
  };
  return { ref: o.ref, client: o.client.name, what: o.title, total_cents: o.total_cents, target: isDone(o) ? "" : `Due ${day(target)}`, late, move, ...by[move] };
}

const GROUPS: { key: BoardGroup; title: string }[] = [
  { key: "needs_you", title: "Needs you" },
  { key: "with_client", title: "With the client" },
  { key: "in_the_works", title: "In the works" },
  { key: "on_the_road", title: "On the road" },
];

export async function board(file: OrderFile, tab: BoardTab, now: Date): Promise<Board> {
  const orders = (await file.all()).sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime());
  const open = orders.filter((o) => !isDone(o)).map((o) => boardRow(o, now));
  const done = orders.filter(isDone).map((o) => boardRow(o, now));
  return {
    tab, counts: { open: open.length, done: done.length }, needs_you: open.filter((r) => r.group === "needs_you").length,
    groups: GROUPS.map((g) => ({ ...g, rows: open.filter((r) => r.group === g.key) })).filter((g) => g.rows.length), flat: done,
  };
}

export type DeskOrder = {
  ref: string; client: { name: string; contact: string }; title: string; state: OrderState; state_word: string; chip: { tone: Tone; words: string }; steps: Step[];
  move: Move; target: string; late: boolean; hold: { reason: string; since: string } | null; total_cents: number; paid: string; quote_ref: string | null;
  lines: { id: string; name: string; colour: string; colour_hex: string; picture: string | null; quantity: number; decoration_words: string }[];
  proof: { ref: string; round: number; sheet_picture: string | null; arrived: string | null; sent: string | null; signed: string | null };
  supply: Supply | null; // staff only
  shipment: { waybill: string; service: string; sent: string } | null;
  log: { at: Date; words: string }[]; messages: BookMessage[];
};

export async function deskOrder(file: OrderFile, ref: string, now: Date): Promise<DeskOrder | null> {
  const o = await file.byRef(ref);
  if (!o) return null;
  const row = boardRow(o, now);
  return {
    ref: o.ref, client: { name: o.client.name, contact: o.client.contact_name }, title: o.title, state: o.state, state_word: DESK_WORDS[o.state], chip: row.chip, steps: o.state === "cancelled" ? [] : steps(o.state),
    move: row.move, target: row.target, late: row.late, hold: o.hold ? { reason: o.hold.reason, since: day(o.hold.since) } : null, total_cents: o.total_cents, paid: day(o.paid_at), quote_ref: o.quote_ref,
    lines: o.lines.map((l) => ({ id: l.id, name: l.product_name, colour: l.colour, colour_hex: l.colour_hex, picture: l.picture, quantity: l.quantity, decoration_words: l.decoration_words })),
    proof: { ref: o.proof.ref, round: o.proof.round, sheet_picture: o.proof.sheet_picture, arrived: o.proof.arrived_at && day(o.proof.arrived_at), sent: o.proof.sent_at && day(o.proof.sent_at), signed: o.proof.signed && `${o.proof.signed.name}, ${day(o.proof.signed.at)}` },
    supply: supplyFor(o.ref), shipment: o.shipment ? { waybill: o.shipment.waybill, service: o.shipment.service, sent: day(o.shipment.sent_at) } : null,
    log: [...o.log].reverse(), messages: o.messages,
  };
}
