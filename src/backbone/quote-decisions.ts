// Trigger 9 (brief section 4): the client declines, or day 10 passes. The first state changes built on the
// backbone, and the pattern every later one follows: lock, run the machine, write the state, describe the effects.
import { allAgreed } from "../domain/line.ts";
import { quoteTransition, type DeclineReason, type QuoteContext } from "../domain/quote.ts";
import type { Actor, Refused } from "../domain/result.ts";
import { newId } from "../events/envelope.ts";
import type { Db, Tx } from "../db.ts";
import { commit, type Change, type Committed } from "./commit.ts";

type Locked = { id: string; ref: string; client_id: string; state: string; version: number; valid_until: Date | null };

async function lockQuote(tx: Tx, ref: string, now: Date): Promise<{ quote: Locked; ctx: QuoteContext } | null> {
  const rows = await tx.$queryRaw<Locked[]>`SELECT id, ref, client_id, state::text AS state, version, valid_until FROM quote WHERE ref = ${ref} FOR UPDATE`;
  const quote = rows[0];
  if (!quote) return null;
  const lines = await tx.quoteLine.findMany({ where: { quote_id: quote.id, removed_at: null }, select: { state: true } });
  return { quote, ctx: { allLinesAgreed: allAgreed(lines.map((l) => l.state)), lineCount: lines.length, now, validUntil: quote.valid_until } };
}

class Refusal extends Error {
  constructor(readonly refused: Refused) { super(refused.reason); }
}
const refused = async <T>(run: Promise<Committed<T>>): Promise<Committed<T> | Refused> => run.catch((e) => { if (e instanceof Refusal) return e.refused; throw e; });

export function declineQuote(db: Db, now: Date, input: { ref: string; actor: Extract<Actor, "client" | "staff">; personId?: string; reason: DeclineReason; budgetCents?: number; note?: string }): Promise<Committed<{ state: string }> | Refused> {
  return refused(commit(db, now, async (tx) => {
    const found = await lockQuote(tx, input.ref, now);
    if (!found) throw new Refusal({ ok: false, code: "not_found", reason: `no quote ${input.ref}` });
    const { quote, ctx } = found;
    const next = quoteTransition({ state: quote.state as never, version: quote.version }, { type: "decline", reason: input.reason, budgetCents: input.budgetCents, note: input.note }, input.actor, ctx);
    if (!next.ok) throw new Refusal(next);
    await tx.quote.update({ where: { id: quote.id }, data: { state: next.value.state } });
    await tx.decline.create({ data: { id: newId("dc"), quote_id: quote.id, version: quote.version, reason: input.reason, budget_cents: input.budgetCents ?? null, note: input.note ?? null, person_id: input.personId ?? null } });
    const rework = input.reason === "too_expensive"; // opens a re-work request on the Desk
    const change: Change = {
      type: "quote.declined", subject: { type: "quote", id: quote.ref }, clientId: quote.client_id, audience: "both", actor: input.actor, actorId: input.personId,
      data: { quote_ref: quote.ref, version: quote.version, reason: input.reason, ...(input.budgetCents ? { budget_cents: input.budgetCents } : {}), rework_requested: rework },
      dueAt: rework ? now : undefined,
      effects: [
        { kind: "nelson_event", payload: { type: "quote.declined", subject: { type: "quote", id: quote.ref }, data: { quote_ref: quote.ref, version: quote.version, reason: input.reason } } },
        { kind: "notify", payload: { party: "client", template: "quote_declined_thanks", person_id: input.personId, channels: ["email", "portal"], vars: { quote_ref: quote.ref } } },
      ],
    };
    return { result: { state: next.value.state }, change };
  }));
}

export function expireQuote(db: Db, now: Date, input: { ref: string; cause: "no_reply" | "validity" }): Promise<Committed<{ state: string }> | Refused> {
  return refused(commit(db, now, async (tx) => {
    const found = await lockQuote(tx, input.ref, now);
    if (!found) throw new Refusal({ ok: false, code: "not_found", reason: `no quote ${input.ref}` });
    const { quote, ctx } = found;
    const next = quoteTransition({ state: quote.state as never, version: quote.version }, { type: "expire", cause: input.cause }, "auto", ctx);
    if (!next.ok) throw new Refusal(next);
    await tx.quote.update({ where: { id: quote.id }, data: { state: next.value.state } });
    const change: Change = {
      type: "quote.expired", subject: { type: "quote", id: quote.ref }, clientId: quote.client_id, audience: "both", actor: "auto",
      data: { quote_ref: quote.ref, version: quote.version, cause: input.cause },
      effects: [
        { kind: "nelson_event", payload: { type: "quote.expired", subject: { type: "quote", id: quote.ref }, data: { quote_ref: quote.ref, version: quote.version, cause: input.cause } } },
        { kind: "notify", payload: { party: "client", template: "quote_expired_thanks", channels: ["email", "portal"], vars: { quote_ref: quote.ref } } },
      ],
    };
    return { result: { state: next.value.state }, change };
  }));
}
