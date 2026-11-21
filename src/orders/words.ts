// Words both surfaces use for an order. Customer-safe.
import { ORDER_STATES, type OrderState } from "../domain/order.ts";
import type { Tone } from "../ui/bits.tsx";

// The six steps a client follows. The two proof states are one step to them.
export const STEPS = ["Paid", "Proof", "Print master", "In production", "Dispatched", "Delivered"] as const;
const STEP_OF: Record<OrderState, number> = { paid: 0, proof_with_nelson: 1, proof_with_client: 1, signed: 2, in_production: 3, dispatched: 4, delivered: 5, cancelled: -1 };

export type Step = { words: string; at: "done" | "now" | "next" };
export function steps(state: OrderState): Step[] {
  const here = STEP_OF[state];
  return STEPS.map((words, i) => ({ words, at: state === "delivered" || i < here ? "done" : i === here ? "now" : "next" }));
}

export const ORDER_TONE: Record<OrderState, Tone> = { paid: "plain", proof_with_nelson: "plain", proof_with_client: "warn", signed: "ok", in_production: "ok", dispatched: "ok", delivered: "plain", cancelled: "bad" };
export const ORDER_REF = /^N-\d{4,6}$/;
export { ORDER_STATES };
