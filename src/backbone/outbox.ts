// The outbox worker (brief 7.3, step 3). Vercel Cron runs drain() every minute and a kick follows each commit.
// It sends each row, retries with backoff and marks it done. A row that runs out of attempts is marked failed and
// writes an event that lands on Today. Nothing fails silently.
import { envelope } from "../events/envelope.ts";
import { sign, SIGNATURE_HEADER } from "../events/signing.ts";
import type { Db } from "../db.ts";
import { writeEvent } from "./commit.ts";

export type OutboxRow = { id: string; event_id: string; kind: string; payload: unknown; attempts: number };
export type Handler = (row: OutboxRow, now: Date) => Promise<void>;
export type Handlers = Partial<Record<"notify" | "nelson_event" | "xero", Handler>>;

export const MAX_ATTEMPTS = 8;
const LOCK_SECONDS = 120;

// 1 min, 4 min, 16 min, 64 min, then every 4 hours.
export const backoffSeconds = (attempt: number): number => Math.min(60 * 4 ** (attempt - 1), 4 * 3600);

export type DrainResult = { sent: string[]; retrying: string[]; failed: string[] };

export async function drain(db: Db, handlers: Handlers, now: Date, limit = 20): Promise<DrainResult> {
  const kinds = Object.keys(handlers);
  const out: DrainResult = { sent: [], retrying: [], failed: [] };
  if (!kinds.length) return out;
  const lockedUntil = new Date(now.getTime() + LOCK_SECONDS * 1000);
  // Claim in one statement, so two workers never send the same row.
  const rows = await db.$queryRaw<OutboxRow[]>`
    UPDATE outbox SET locked_until = ${lockedUntil}, attempts = attempts + 1, updated_at = ${now}
    WHERE id IN (
      SELECT id FROM outbox
      WHERE status = 'pending' AND next_attempt_at <= ${now} AND (locked_until IS NULL OR locked_until <= ${now}) AND kind = ANY(${kinds})
      ORDER BY next_attempt_at, id LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING id, event_id, kind, payload, attempts`;

  for (const row of rows) {
    try {
      await handlers[row.kind as keyof Handlers]!(row, now);
      await db.outbox.update({ where: { id: row.id }, data: { status: "done", done_at: now, locked_until: null, last_error: null } });
      out.sent.push(row.id);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      if (row.attempts >= MAX_ATTEMPTS) {
        await db.$transaction(async (tx) => {
          await tx.outbox.update({ where: { id: row.id }, data: { status: "failed", locked_until: null, last_error: message } });
          await writeEvent(tx, now, { type: "outbox.failed", subject: { type: "outbox", id: row.id }, audience: "staff", data: { kind: row.kind, event_id: row.event_id, error: message }, actor: "auto", dueAt: now });
        });
        out.failed.push(row.id);
      } else {
        await db.outbox.update({ where: { id: row.id }, data: { locked_until: null, last_error: message, next_attempt_at: new Date(now.getTime() + backoffSeconds(row.attempts) * 1000) } });
        out.retrying.push(row.id);
      }
    }
  }
  return out;
}

// Desk to Nelson events: one envelope, signed, with the outbox row's id as the idempotency key so a retry is safe.
export function nelsonEventHandler(cfg: { baseUrl: string; webhookSecret: string; fetch?: typeof fetch }): Handler {
  return async (row, now) => {
    const p = row.payload as { type: string; subject: { type: "quote" | "proof"; id: string }; data: Record<string, unknown> };
    // The event id is derived from the outbox row, so Nelson dedupes a retry.
    const raw = JSON.stringify(envelope(p.type, p.subject, p.data, now, `ev_${row.id.replace(/^ob_/, "")}`));
    const res = await (cfg.fetch ?? fetch)(new URL("/api/v1/events", cfg.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": row.id, [SIGNATURE_HEADER]: sign(raw, cfg.webhookSecret, now) },
      body: raw,
    });
    if (!res.ok) throw new Error(`Nelson answered ${res.status}`);
  };
}
