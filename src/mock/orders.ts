// The stand-in order file: eight orders that cover every step an order takes, so both surfaces can be walked from
// payment to delivery. Dates count back from "now". N-1035 and N-1019 are the orders the sample quotes Q-00005 and
// Q-00002 became; the rest came through the shop. All figures are illustrative.
import type { OrderState } from "../domain/order.ts";
import { sha256Hex, type ProofState } from "../domain/proof.ts";
import type { FiledOrder, OrderFile, OrderLine, OrderProof, Shipment } from "../orders/book.ts";
import type { BookClient } from "../quotes/book.ts";
import { CLIENTS } from "./book.ts";
import { MOTHER_MOON_PICTURES as PIC } from "./mother-moon-pictures.ts";

const DAY = 86_400_000;

export function mockOrderList(now: Date): FiledOrder[] {
  const ago = (days: number, hour = 9) => new Date(Math.floor(now.getTime() / DAY) * DAY - days * DAY + (hour - 2) * 3_600_000);
  const proofOf = (ref: string, state: ProofState, over: Partial<OrderProof> = {}): OrderProof =>
    ({ ref: ref.replace("N-", "PP-"), state, round: state === "awaiting_sheet" ? 0 : 1, sheet_sha256: state === "awaiting_sheet" ? null : sha256Hex(`${ref} sheet 1`), sheet_picture: null, arrived_at: null, sent_at: null, signed: null, ...over });
  const order = (o: { ref: string; client: BookClient; state: OrderState; paidDaysAgo: number; line: Omit<OrderLine, "id" | "line_total_cents" | "picture"> & { picture?: string | null }; total_cents: number; proof: OrderProof; quote_ref?: string; hold?: FiledOrder["hold"]; shipment?: Shipment; log: [number, number, string][]; messages?: FiledOrder["messages"] }): FiledOrder => ({
    ref: o.ref, client: o.client, title: `${o.line.product_name} × ${o.line.quantity}`, way_in: o.quote_ref ? "quote" : "cart", quote_ref: o.quote_ref ?? null, state: o.state, hold: o.hold ?? null,
    paid_at: ago(o.paidDaysAgo, 12), total_cents: o.total_cents, lines: [{ picture: null, ...o.line, id: `ol_${o.ref.slice(2)}`, line_total_cents: o.total_cents }],
    proof: { ...o.proof, sheet_picture: o.proof.state === "awaiting_sheet" ? null : o.line.picture ?? null }, production_days: 7, transit_days: 2, shipment: o.shipment ?? null,
    log: o.log.map(([days, hour, words]) => ({ at: ago(days, hour), words })), messages: o.messages ?? [],
  });

  return [
    order({
      ref: "N-1038", client: CLIENTS.brewing, state: "paid", paidDaysAgo: 0, total_cents: 770_000, proof: proofOf("N-1038", "awaiting_sheet"),
      line: { product_name: "Steel Bottle Opener", colour: "Brushed steel", colour_hex: "#b9bcc0", quantity: 100, decoration_words: "Laser engrave · 30 × 12 mm" },
      log: [[0, 12, "Paid by card"]],
    }),
    order({
      ref: "N-1036", client: CLIENTS.lagom, state: "proof_with_nelson", paidDaysAgo: 1, total_cents: 860_000, proof: proofOf("N-1036", "with_nelson", { arrived_at: ago(0, 10) }),
      line: { product_name: "6 Panel Cap", colour: "Stone", colour_hex: "#cfc6b4", quantity: 50, decoration_words: "Front embroidery · 1 thread · 60 × 25 mm" },
      log: [[1, 12, "Paid by card"], [0, 10, "Proof sheet in"]],
    }),
    order({
      ref: "N-1035", client: CLIENTS.moon, state: "proof_with_client", paidDaysAgo: 2, total_cents: 900_000, quote_ref: "Q-00005", proof: proofOf("N-1035", "with_client", { arrived_at: ago(1, 10), sent_at: ago(1, 15) }),
      line: { product_name: "Everyday Shopper", colour: "Natural", colour_hex: "#e6dcc6", picture: PIC.shopper, quantity: 120, decoration_words: "Screen print · 1 colour · 200 × 200 mm" },
      log: [[2, 12, "Paid by EFT"], [1, 10, "Proof sheet in"], [1, 15, "Proof sent to you"]],
      messages: [{ author: "nelson", name: "Alan", at: ago(1, 15), channel: "whatsapp", tag: "Proof", text: "Your proof is ready to sign. Nothing is made until you do." }],
    }),
    order({
      ref: "N-1033", client: CLIENTS.fynbos, state: "signed", paidDaysAgo: 4, total_cents: 780_000, proof: proofOf("N-1033", "signed", { arrived_at: ago(2, 11), sent_at: ago(2, 14), signed: { name: "Thandi Mokoena", at: ago(0, 8) } }),
      line: { product_name: "Canvas Apron", colour: "Olive", colour_hex: "#6b6f45", quantity: 30, decoration_words: "Chest embroidery · 2 threads · 70 × 30 mm" },
      log: [[4, 12, "Paid by card"], [2, 11, "Proof sheet in"], [2, 14, "Proof sent to you"], [0, 8, "Proof signed by Thandi Mokoena"]],
    }),
    order({
      ref: "N-1031", client: CLIENTS.haras, state: "in_production", paidDaysAgo: 13, total_cents: 1_050_000, proof: proofOf("N-1031", "signed", { arrived_at: ago(11, 11), sent_at: ago(11, 14), signed: { name: "Pieter van Wyk", at: ago(10, 9) } }),
      line: { product_name: "Zip Folder A4", colour: "Black", colour_hex: "#1c1c1c", quantity: 250, decoration_words: "Deboss · front · 80 × 30 mm" },
      log: [[13, 12, "Paid by EFT"], [11, 14, "Proof sent to you"], [10, 9, "Proof signed by Pieter van Wyk"], [10, 11, "In production"]],
    }),
    order({
      ref: "N-1030", client: CLIENTS.karoo, state: "in_production", paidDaysAgo: 8, total_cents: 1_240_000, hold: { reason: "Six sets are short. We are confirming the balance with you.", since: ago(1, 10) },
      proof: proofOf("N-1030", "signed", { arrived_at: ago(6, 11), sent_at: ago(6, 14), signed: { name: "Lerato Khumalo", at: ago(5, 9) } }),
      line: { product_name: "Gift Set", colour: "Kraft", colour_hex: "#b89b72", quantity: 40, decoration_words: "Laser engrave · lid" },
      log: [[8, 12, "Paid by card"], [5, 9, "Proof signed by Lerato Khumalo"], [5, 11, "In production"], [1, 10, "On hold"]],
    }),
    order({
      ref: "N-1028", client: CLIENTS.moon, state: "dispatched", paidDaysAgo: 14, total_cents: 650_000, proof: proofOf("N-1028", "signed", { arrived_at: ago(12, 11), sent_at: ago(12, 14), signed: { name: "Holly Daniels", at: ago(11, 9) } }),
      line: { product_name: "The Copper Tumbler", colour: "Burnt orange", colour_hex: "#a8502f", picture: PIC.copper_tumbler, quantity: 50, decoration_words: "Laser engraving" },
      shipment: { waybill: "WB-482913", service: "Economy", sent_at: ago(1, 14), delivered_at: null, steps: [{ at: ago(1, 14), words: "Collected in Cape Town" }, { at: ago(0, 7), words: "Out for delivery" }] },
      log: [[14, 12, "Paid by card"], [12, 14, "Proof sent to you"], [11, 9, "Proof signed by Holly Daniels"], [11, 11, "In production"], [1, 14, "Dispatched"]],
    }),
    order({
      ref: "N-1019", client: CLIENTS.moon, state: "delivered", paidDaysAgo: 52, total_cents: 750_000, quote_ref: "Q-00002", proof: proofOf("N-1019", "signed", { arrived_at: ago(50, 11), sent_at: ago(50, 14), signed: { name: "Holly Daniels", at: ago(49, 9) } }),
      line: { product_name: "The Bamboo-Lid Mug", colour: "White and bamboo", colour_hex: "#f4f2ee", picture: PIC.bamboo_mug, quantity: 50, decoration_words: "Pad print · 1 colour · 45 × 30 mm" },
      shipment: { waybill: "WB-466120", service: "Economy", sent_at: ago(40, 14), delivered_at: ago(38, 11), steps: [{ at: ago(40, 14), words: "Collected in Cape Town" }, { at: ago(38, 11), words: "Delivered. Signed for by Holly" }] },
      log: [[52, 10, "Paid by card"], [49, 9, "Proof signed by Holly Daniels"], [49, 11, "In production"], [40, 14, "Dispatched"], [38, 11, "Delivered"]],
    }),
  ];
}

export function mockOrders(now: () => Date = () => new Date()): OrderFile {
  return {
    all: async () => mockOrderList(now()),
    forClient: async (clientId) => mockOrderList(now()).filter((o) => o.client.id === clientId),
    byRef: async (ref) => mockOrderList(now()).find((o) => o.ref === ref) ?? null,
  };
}
