// The order (brief 3.3). Fixed, only moves forward. Cart orders and quote orders are the same order.
import { ok, refuse, type Actor, type Result } from "./result.ts";

export const ORDER_STATES = ["paid", "proof_with_nelson", "proof_with_client", "signed", "in_production", "dispatched", "delivered", "cancelled"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export type Order = { state: OrderState; onHold: boolean };

export type OrderEvent =
  | { type: "proof_arrived" } // the print house's sheet lands
  | { type: "proof_approved" } // Alan approves the sheet
  | { type: "proof_returned" } // the client asks for a change, or a new sheet restarts the proof
  | { type: "proof_signed" } // the client signs. Design locked
  | { type: "supplier_order_placed" } // Alan's click. It is the news
  | { type: "waybill_saved"; waybill: string } // Alan's click. It is the news
  | { type: "delivery_confirmed" } // the courier
  | { type: "hold"; reason: string } // stock short, client to call. The client is told
  | { type: "release" }
  | { type: "cancel"; reason: string };

type Move = { from: readonly OrderState[]; to: OrderState; by: readonly Actor[] };
const MOVES: Record<Exclude<OrderEvent["type"], "hold" | "release" | "cancel">, Move> = {
  proof_arrived: { from: ["paid", "proof_with_nelson"], to: "proof_with_nelson", by: ["auto"] },
  proof_approved: { from: ["proof_with_nelson"], to: "proof_with_client", by: ["staff"] },
  // The one step back the brief asks for (3.4, step 5): the proof returns to Nelson. Nothing after Signed goes back.
  proof_returned: { from: ["proof_with_client"], to: "proof_with_nelson", by: ["client", "staff"] },
  proof_signed: { from: ["proof_with_client"], to: "signed", by: ["client"] },
  supplier_order_placed: { from: ["signed"], to: "in_production", by: ["staff"] },
  waybill_saved: { from: ["in_production"], to: "dispatched", by: ["staff"] },
  delivery_confirmed: { from: ["dispatched"], to: "delivered", by: ["auto", "staff"] },
};

export function orderTransition(order: Order, event: OrderEvent, actor: Actor): Result<Order> {
  const { state, onHold } = order;
  const done = state === "delivered" || state === "cancelled";

  if (event.type === "hold") {
    if (actor !== "staff") return refuse("wrong_actor", "only staff put an order on hold");
    if (done) return refuse("wrong_state", `a ${state} order cannot be held`);
    if (onHold) return refuse("already_on_hold", "the order is already on hold");
    if (!event.reason.trim()) return refuse("missing_reason", "a hold tells the client why");
    return ok({ state, onHold: true });
  }
  if (event.type === "release") {
    if (actor !== "staff") return refuse("wrong_actor", "only staff release a hold");
    if (!onHold) return refuse("not_on_hold", "the order is not on hold");
    return ok({ state, onHold: false });
  }
  if (event.type === "cancel") {
    if (actor === "client") return refuse("wrong_actor", "a client asks; staff or Nelson's pack cancels");
    if (done) return refuse("wrong_state", `a ${state} order cannot be cancelled`);
    if (!event.reason.trim()) return refuse("missing_reason", "a cancellation tells the client why");
    return ok({ state: "cancelled", onHold: false });
  }

  const move = MOVES[event.type];
  if (!move.by.includes(actor)) return refuse("wrong_actor", `${event.type} is fired by ${move.by.join(" or ")}, not ${actor}`);
  if (!move.from.includes(state)) return refuse("wrong_state", `${event.type} is not allowed from ${state}`);
  if (onHold) return refuse("on_hold", "an order on hold does not move until it is released");
  if (event.type === "waybill_saved" && !event.waybill.trim()) return refuse("missing_waybill", "dispatch needs the waybill number");
  return ok({ state: move.to, onHold });
}

// Client words (brief section 4, "Words match"). The Desk adds two of its own.
export const PORTAL_WORDS: Record<OrderState, string> = {
  paid: "Paid",
  proof_with_nelson: "Proof",
  proof_with_client: "Proof",
  signed: "Print master",
  in_production: "In production",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const DESK_WORDS: Record<OrderState, string> = {
  ...PORTAL_WORDS,
  proof_with_nelson: "Proof · with Nelson",
  proof_with_client: "Proof · with client",
  signed: "Signed · place order",
};

// Nelson writes pack status (order_packs.status); the Desk writes the client-facing state. The Desk never sets a
// pack status: it asks Nelson with POST /api/v1/orders/{ref}/status for the two Alan clicks, and mirrors the rest.
export type PackStatus = "ready" | "placed" | "proof_approved" | "in_production" | "dispatched" | "delivered" | "cancelled";

// The furthest pack status an order state implies. Used to spot drift between the two, never to write.
export function expectedPackStatus(state: OrderState): PackStatus {
  switch (state) {
    case "paid":
    case "proof_with_nelson":
    case "proof_with_client":
      return "placed";
    case "signed":
      return "proof_approved";
    case "in_production":
      return "in_production";
    case "dispatched":
      return "dispatched";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
  }
}

// The order event a pack status change from Nelson implies, if any. Only delivery and cancellation arrive this way:
// the rest are fired on the Desk first and Nelson's status follows.
export function orderEventForPackStatus(status: PackStatus): OrderEvent | null {
  if (status === "delivered") return { type: "delivery_confirmed" };
  if (status === "cancelled") return { type: "cancel", reason: "Cancelled in Nelson" };
  return null;
}
