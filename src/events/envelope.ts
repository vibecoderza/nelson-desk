// nelson.event/1 (brief 6.6). One envelope, both ways.
import { randomBytes } from "node:crypto";

export const FROM_NELSON = ["order.paid", "order_pack.status_changed", "order.cancelled", "cost.moved", "design.saved", "quote.basket_added"] as const;
export const TO_NELSON = ["quote.sent", "quote.accepted", "quote.declined", "quote.expired", "proof.signed"] as const;
export type FromNelson = (typeof FROM_NELSON)[number];
export type ToNelson = (typeof TO_NELSON)[number];

export type SubjectType = "order" | "order_pack" | "quote" | "proof" | "design" | "cost";

export type NelsonEvent<T extends string = string, D = Record<string, unknown>> = {
  schema: "nelson.event/1";
  id: string;
  type: T;
  occurred_at: string;
  subject: { type: SubjectType; id: string };
  data: D;
};

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
// Prefixed ids: ev_…, ob_…, c_…, ql_…. 16 characters of 5 bits each: 80 bits, enough to never collide here.
export function newId(prefix: string): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += ALPHABET[bytes[i]! & 31];
  return `${prefix}_${out}`;
}

export function envelope<T extends string, D extends Record<string, unknown>>(type: T, subject: NelsonEvent["subject"], data: D, occurredAt: Date, id = newId("ev")): NelsonEvent<T, D> {
  return { schema: "nelson.event/1", id, type, occurred_at: occurredAt.toISOString(), subject, data };
}
