// One event, three effects (brief 7.3). Every state change goes through commit(): the new state, one event row and
// one outbox row per effect are written in one transaction, or none of them are.
import { assertPortalSafe } from "../exposure/private.ts";
import { newId } from "../events/envelope.ts";
import type { Db, Tx } from "../db.ts";
import type { Actor } from "../domain/result.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export type Json = Prisma.InputJsonValue;

export type Effect =
  | { kind: "notify"; payload: { party: "client" | "supplier" | "print_house" | "staff"; template: string; person_id?: string; channels: ("email" | "whatsapp" | "portal")[]; vars: Record<string, Json> } }
  | { kind: "nelson_event"; payload: { type: string; subject: { type: string; id: string }; data: Record<string, Json> } }
  | { kind: "xero"; payload: Record<string, Json> };

export type Change = {
  type: string; // e.g. quote.declined
  subject: { type: string; id: string };
  clientId?: string;
  // "both": the Portal reads this event (job log, milestones), so its data is checked before it is written.
  audience: "staff" | "both";
  data: Record<string, Json>;
  actor: Actor;
  actorId?: string;
  dueAt?: Date; // puts the event on Today until it is resolved
  effects: Effect[];
};

export type Committed<T> = { result: T; eventId: string; outboxIds: string[] };

export async function commit<T>(db: Db, now: Date, work: (tx: Tx) => Promise<{ result: T; change: Change }>): Promise<Committed<T>> {
  return db.$transaction(async (tx) => {
    const { result, change } = await work(tx);
    const eventId = await writeEvent(tx, now, change);
    const outboxIds: string[] = [];
    for (const effect of change.effects) {
      // Anything addressed to a client is checked here, before it can be queued.
      if (effect.kind === "notify" && effect.payload.party === "client") assertPortalSafe(effect.payload, `the ${effect.payload.template} message`);
      const id = newId("ob");
      await tx.outbox.create({ data: { id, event_id: eventId, kind: effect.kind, payload: effect.payload as Json, next_attempt_at: now } });
      outboxIds.push(id);
    }
    return { result, eventId, outboxIds };
  });
}

export async function writeEvent(tx: Tx, now: Date, change: Omit<Change, "effects">): Promise<string> {
  if (change.audience === "both") assertPortalSafe(change.data, `the ${change.type} event`);
  const id = newId("ev");
  await tx.event.create({
    data: {
      id, type: change.type, subject_type: change.subject.type, subject_id: change.subject.id, client_id: change.clientId ?? null,
      audience: change.audience, data: change.data, actor: change.actor, actor_id: change.actorId ?? null, occurred_at: now, due_at: change.dueAt ?? null,
    },
  });
  return id;
}
