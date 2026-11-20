// Nelson to Desk events land here (brief 6.6): verified, deduped by id, stored, then answered 202.
// Turning a stored event into state (order.paid makes an order) is each phase's own handler.
import { FROM_NELSON, type FromNelson, type NelsonEvent } from "../events/envelope.ts";
import { verify } from "../events/signing.ts";
import type { Db } from "../db.ts";

export type Received = { status: 202; duplicate: boolean; event: NelsonEvent<FromNelson> } | { status: 400 | 401; error: string };

export function parseNelsonEvent(rawBody: string): NelsonEvent<FromNelson> | null {
  let e: unknown;
  try { e = JSON.parse(rawBody); } catch { return null; }
  if (!e || typeof e !== "object") return null;
  const v = e as Record<string, unknown>;
  const subject = v.subject as Record<string, unknown> | null;
  const okay = v.schema === "nelson.event/1" && typeof v.id === "string" && /^ev_[A-Za-z0-9]{10,}$/.test(v.id)
    && typeof v.type === "string" && (FROM_NELSON as readonly string[]).includes(v.type)
    && typeof v.occurred_at === "string" && !Number.isNaN(Date.parse(v.occurred_at))
    && !!subject && typeof subject === "object" && typeof subject.type === "string" && typeof subject.id === "string"
    && !!v.data && typeof v.data === "object" && !Array.isArray(v.data);
  return okay ? (e as NelsonEvent<FromNelson>) : null;
}

// `db` may be a getter, so an unsigned request is refused before a database connection is ever opened.
export async function receiveNelsonEvent(db: Db | (() => Db), input: { rawBody: string; signature: string | null; secret: string; now: Date }): Promise<Received> {
  const verified = verify(input.rawBody, input.signature, input.secret, input.now);
  if (!verified.ok) return { status: 401, error: verified.reason };
  const event = parseNelsonEvent(input.rawBody);
  if (!event) return { status: 400, error: "not a nelson.event/1 the Desk accepts" };
  const inserted = await (typeof db === "function" ? db() : db).$executeRaw`
    INSERT INTO webhook_inbox (id, source, external_id, type, payload, received_at, created_at, updated_at)
    VALUES (${"wi_" + event.id.slice(3)}, 'nelson', ${event.id}, ${event.type}, ${JSON.stringify(event)}::jsonb, ${input.now}, ${input.now}, ${input.now})
    ON CONFLICT (source, external_id) DO NOTHING`;
  return { status: 202, duplicate: inserted === 0, event };
}
