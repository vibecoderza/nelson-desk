// The order file: what an order screen reads. Customer view only, the same on both surfaces. Nothing in here names
// a supplier, a print house, a cost or a margin: on the Desk those sit in src/desk and stay there.
// The shapes follow prisma/schema.prisma (order, order_line, proof, signature, shipment, hold), so the database
// reader that replaces the stand-in returns the same thing.
import type { OrderState } from "../domain/order.ts";
import type { ProofState } from "../domain/proof.ts";
import type { BookClient, BookMessage } from "../quotes/book.ts";
import { addWorkingDays } from "./dates.ts";

export type OrderLine = { id: string; product_name: string; colour: string; colour_hex: string; picture: string | null; quantity: number; decoration_words: string; line_total_cents: number };

export type OrderProof = {
  ref: string; // PP-1035
  state: ProofState;
  round: number;
  sheet_sha256: string | null;
  sheet_picture: string | null; // the print house's sheet, as an image source
  arrived_at: Date | null;
  sent_at: Date | null; // when it went to the client
  signed: { name: string; at: Date } | null;
};

export type Shipment = { waybill: string; service: string; sent_at: Date; delivered_at: Date | null; steps: { at: Date; words: string }[] };

export type FiledOrder = {
  ref: string; // N-1035
  client: BookClient;
  title: string;
  way_in: "quote" | "cart";
  quote_ref: string | null;
  state: OrderState;
  hold: { reason: string; since: Date } | null;
  paid_at: Date;
  total_cents: number;
  lines: OrderLine[];
  proof: OrderProof;
  production_days: number; // Nelson's answer, working days from the signed proof
  transit_days: number;
  shipment: Shipment | null;
  log: { at: Date; words: string }[]; // the job log, in the client's words
  messages: BookMessage[];
};

export type OrderFile = {
  all(): Promise<FiledOrder[]>;
  forClient(clientId: string): Promise<FiledOrder[]>;
  byRef(ref: string): Promise<FiledOrder | null>;
};

export const isDone = (o: FiledOrder) => o.state === "delivered" || o.state === "cancelled";

// target = sign date + production + transit, in working days. Unsigned, it is counted from today: it holds if the
// client signs today, and each day later moves it by one working day.
export function targetDate(o: FiledOrder, now: Date): Date | null {
  if (o.state === "cancelled") return null;
  if (o.shipment?.delivered_at) return o.shipment.delivered_at;
  return addWorkingDays(o.proof.signed?.at ?? now, o.production_days + o.transit_days);
}
// The day the goods are due out of production.
export const shipBy = (o: FiledOrder): Date | null => (o.proof.signed ? addWorkingDays(o.proof.signed.at, o.production_days) : null);
