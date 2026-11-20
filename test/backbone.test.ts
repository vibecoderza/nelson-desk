// One event, three effects (brief 7.3): state, event and outbox in one transaction; a worker that retries and never
// fails silently; an inbox that verifies and dedupes.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { Server } from "node:http";
import type { PGlite } from "@electric-sql/pglite";
import type { PrismaClient } from "@/generated/prisma/client.ts";
import { commit } from "@/backbone/commit.ts";
import { backoffSeconds, drain, MAX_ATTEMPTS, nelsonEventHandler, type Handler } from "@/backbone/outbox.ts";
import { receiveNelsonEvent } from "@/backbone/inbox.ts";
import { declineQuote, expireQuote } from "@/backbone/quote-decisions.ts";
import { sign } from "@/events/signing.ts";
import { fixture, loadSchemas, validator } from "@/contract/load.ts";
import { listen, MOCK_WEBHOOK_SECRET } from "../mock/server.ts";
import { seedQuote, testDb } from "./helpers/db.ts";

let pg: PGlite, db: PrismaClient;
const now = new Date("2026-11-21T08:00:00Z");
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);

beforeEach(async () => ({ pg, db } = await testDb()));

describe("commit", () => {
  test("a decline writes the state, one event and one outbox row per effect, together", async () => {
    await seedQuote(db);
    const done = await declineQuote(db, now, { ref: "Q-00007", actor: "client", personId: "p_holly", reason: "too_expensive", budgetCents: 1_200_000 });
    if (!("eventId" in done)) throw new Error("refused");
    expect((await db.quote.findUniqueOrThrow({ where: { ref: "Q-00007" } })).state).toBe("declined");
    expect(await db.decline.findFirstOrThrow()).toMatchObject({ reason: "too_expensive", budget_cents: 1_200_000, version: 3 });
    const event = await db.event.findUniqueOrThrow({ where: { id: done.eventId } });
    expect(event).toMatchObject({ type: "quote.declined", subject_type: "quote", subject_id: "Q-00007", client_id: "c_mothermoon", audience: "both", actor: "client" });
    expect(event.due_at).toEqual(now); // too expensive opens a re-work request: it lands on Today
    const outbox = await db.outbox.findMany({ where: { event_id: done.eventId }, orderBy: { kind: "asc" } });
    expect(outbox.map((o) => [o.kind, o.status])).toEqual([["nelson_event", "pending"], ["notify", "pending"]]);
  });

  test("a refused move writes nothing", async () => {
    await seedQuote(db);
    const refused = await declineQuote(db, now, { ref: "Q-00007", actor: "client", reason: "too_expensive" });
    expect(refused).toMatchObject({ ok: false, code: "budget_required" });
    expect(await declineQuote(db, now, { ref: "Q-99999", actor: "client", reason: "timing" })).toMatchObject({ ok: false, code: "not_found" });
    expect((await db.quote.findUniqueOrThrow({ where: { ref: "Q-00007" } })).state).toBe("final");
    expect(await db.event.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  test("if an effect cannot be written, the state change is rolled back with it", async () => {
    await seedQuote(db);
    const attempt = commit(db, now, async (tx) => {
      await tx.quote.update({ where: { ref: "Q-00007" }, data: { state: "declined" } });
      return { result: null, change: { type: "quote.declined", subject: { type: "quote", id: "Q-00007" }, audience: "both" as const, data: {}, actor: "client" as const,
        // A message to a client that names the supplier. The backbone refuses to queue it.
        effects: [{ kind: "notify" as const, payload: { party: "client" as const, template: "x", channels: ["email" as const], vars: { note: "Stock is with Amrod" } } }] } };
    });
    await expect(attempt).rejects.toThrow(/would expose supplier_name/);
    expect((await db.quote.findUniqueOrThrow({ where: { ref: "Q-00007" } })).state).toBe("final");
    expect(await db.event.count()).toBe(0);
  });

  test("an event the Portal reads cannot carry staff data", async () => {
    const attempt = commit(db, now, async () => ({ result: null, change: { type: "quote.sent", subject: { type: "quote", id: "Q-00007" }, audience: "both" as const, data: { margin_cents: 5 }, actor: "staff" as const, effects: [] } }));
    await expect(attempt).rejects.toThrow(/private_key/);
    // The same data on a staff-only event is fine.
    await commit(db, now, async () => ({ result: null, change: { type: "cost.moved", subject: { type: "cost", id: "2026-11-21" }, audience: "staff" as const, data: { margin_cents: 5 }, actor: "auto" as const, effects: [] } }));
    expect(await db.event.count()).toBe(1);
  });

  test("expiry is the same shape: state, event, effects", async () => {
    await seedQuote(db, { state: "working", lineStates: ["agreed", "waiting_on_nelson"] });
    expect(await expireQuote(db, now, { ref: "Q-00007", cause: "validity" })).toMatchObject({ ok: false, code: "still_valid" });
    const done = await expireQuote(db, now, { ref: "Q-00007", cause: "no_reply" });
    expect("eventId" in done).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { ref: "Q-00007" } })).state).toBe("expired");
    expect(await db.outbox.count()).toBe(2);
  });
});

describe("outbox worker", () => {
  const declined = async () => { await seedQuote(db); await declineQuote(db, now, { ref: "Q-00007", actor: "client", reason: "timing" }); };

  test("sends each row once and marks it done", async () => {
    await declined();
    const sent: string[] = [];
    const handler: Handler = async (row) => { sent.push(row.kind); };
    const first = await drain(db, { notify: handler, nelson_event: handler }, now);
    expect(first.sent.length).toBe(2);
    expect(sent.sort()).toEqual(["nelson_event", "notify"]);
    expect((await drain(db, { notify: handler, nelson_event: handler }, later(600))).sent).toEqual([]);
    expect(await db.outbox.count({ where: { status: "done" } })).toBe(2);
  });

  test("a failure is retried with backoff, not before its time", async () => {
    await declined();
    let calls = 0;
    const flaky: Handler = async () => { calls += 1; if (calls === 1) throw new Error("Nelson answered 503"); };
    expect((await drain(db, { nelson_event: flaky }, now)).retrying.length).toBe(1);
    const row = await db.outbox.findFirstOrThrow({ where: { kind: "nelson_event" } });
    expect(row).toMatchObject({ status: "pending", attempts: 1, last_error: "Nelson answered 503", locked_until: null });
    expect(row.next_attempt_at).toEqual(later(60));
    expect((await drain(db, { nelson_event: flaky }, later(59))).sent).toEqual([]);
    expect((await drain(db, { nelson_event: flaky }, later(60))).sent.length).toBe(1);
    expect([1, 2, 3, 4, 5, 6].map(backoffSeconds)).toEqual([60, 240, 960, 3840, 14400, 14400]);
  });

  test("a row with no handler yet is left alone, and a locked row is not taken twice", async () => {
    await declined();
    expect(await drain(db, {}, now)).toEqual({ sent: [], retrying: [], failed: [] });
    await db.outbox.updateMany({ data: { locked_until: later(100) } }); // another worker has them
    expect((await drain(db, { notify: async () => {}, nelson_event: async () => {} }, now)).sent).toEqual([]);
    expect((await drain(db, { notify: async () => {}, nelson_event: async () => {} }, later(101))).sent.length).toBe(2);
  });

  test("a row that runs out of attempts is marked failed and lands on Today", async () => {
    await declined();
    const down: Handler = async () => { throw new Error("connection refused"); };
    let at = now;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) { await drain(db, { nelson_event: down }, at); at = new Date(at.getTime() + 5 * 3600 * 1000); }
    const row = await db.outbox.findFirstOrThrow({ where: { kind: "nelson_event" } });
    expect(row).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, last_error: "connection refused" });
    const alarm = await db.event.findFirstOrThrow({ where: { type: "outbox.failed" } });
    expect(alarm).toMatchObject({ audience: "staff", subject_id: row.id, resolved_at: null });
    expect(alarm.due_at).not.toBeNull();
    expect((await drain(db, { nelson_event: down }, new Date(at.getTime() + 10 * 3600 * 1000))).failed).toEqual([]); // not retried again
  });

  describe("to Nelson", () => {
    let server: Server, url: string, mock: Awaited<ReturnType<typeof listen>>["mock"];
    beforeAll(async () => ({ server, url, mock } = await listen()));
    afterAll(() => new Promise<void>((done) => server.close(() => done())));

    test("a Desk event reaches Nelson signed and valid, and a retry of the same row is deduped", async () => {
      await declined();
      const handler = nelsonEventHandler({ baseUrl: url, webhookSecret: MOCK_WEBHOOK_SECRET });
      const at = new Date(); // the mock checks the signature against the real clock
      await db.outbox.updateMany({ data: { next_attempt_at: new Date(0) } });
      expect((await drain(db, { nelson_event: handler }, at)).sent.length).toBe(1);
      expect(mock.received.length).toBe(1);
      const { ajv } = loadSchemas();
      expect(validator(ajv, "event.json")(mock.received[0])).toBe(true);
      expect(mock.received[0]).toMatchObject({ type: "quote.declined", subject: { type: "quote", id: "Q-00007" }, data: { reason: "timing" } });
      // The worker died after sending and before marking done: the row is sent again, and Nelson sees one event.
      await db.outbox.updateMany({ where: { kind: "nelson_event" }, data: { status: "pending", locked_until: null } });
      await drain(db, { nelson_event: handler }, new Date(at.getTime() + 1000));
      expect(mock.received.length).toBe(1);
      const wrong = nelsonEventHandler({ baseUrl: url, webhookSecret: "not-the-secret" });
      await db.outbox.updateMany({ where: { kind: "nelson_event" }, data: { status: "pending" } });
      expect((await drain(db, { nelson_event: wrong }, new Date(at.getTime() + 2000))).retrying.length).toBe(1);
    });
  });
});

describe("webhook inbox", () => {
  const raw = JSON.stringify(fixture("event.order-paid.json"));
  const secret = "test-secret";

  test("a signed Nelson event is stored once; a replay is accepted and not stored again", async () => {
    const first = await receiveNelsonEvent(db, { rawBody: raw, signature: sign(raw, secret, now), secret, now });
    expect(first).toMatchObject({ status: 202, duplicate: false });
    const again = await receiveNelsonEvent(db, { rawBody: raw, signature: sign(raw, secret, later(30)), secret, now: later(30) });
    expect(again).toMatchObject({ status: 202, duplicate: true });
    const rows = await db.webhookInbox.findMany();
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ source: "nelson", type: "order.paid", processed_at: null });
  });

  test("unsigned, stale, tampered and unknown events are refused and nothing is stored", async () => {
    const header = sign(raw, secret, now);
    expect(await receiveNelsonEvent(db, { rawBody: raw, signature: null, secret, now })).toEqual({ status: 401, error: "missing" });
    expect(await receiveNelsonEvent(db, { rawBody: raw, signature: header, secret, now: later(301) })).toEqual({ status: 401, error: "stale" });
    expect(await receiveNelsonEvent(db, { rawBody: raw.replace("1753500", "1"), signature: header, secret, now })).toEqual({ status: 401, error: "mismatch" });
    expect(await receiveNelsonEvent(db, { rawBody: raw, signature: header, secret: "", now })).toEqual({ status: 401, error: "no_secret" });
    // A Desk to Nelson type arriving at the Desk is not one it accepts, even when signed.
    const outbound = JSON.stringify(fixture("event.quote-sent.json"));
    expect((await receiveNelsonEvent(db, { rawBody: outbound, signature: sign(outbound, secret, now), secret, now })).status).toBe(400);
    expect((await receiveNelsonEvent(db, { rawBody: "{", signature: sign("{", secret, now), secret, now })).status).toBe(400);
    expect(await db.webhookInbox.count()).toBe(0);
  });
});

describe("the database's own rules", () => {
  test("a sent quote version is frozen; only its document keys can be filled in", async () => {
    await seedQuote(db);
    const base = { id: "qv_1", quote_id: "q_1", version: 3, snapshot: { lines: [] }, price_customer: fixture<object>("price-response.customer.json"), price_version: "pv_2026-11-19_a1", total_cents: 1_753_500 };
    await db.quoteVersion.create({ data: base });
    await db.quoteVersion.update({ where: { id: "qv_1" }, data: { total_cents: 1_753_501 } }); // still a draft: free to change
    await db.quoteVersion.update({ where: { id: "qv_1" }, data: { total_cents: 1_753_500, sent_at: now } });
    await expect(db.quoteVersion.update({ where: { id: "qv_1" }, data: { total_cents: 1 } })).rejects.toThrow(/frozen/);
    await expect(db.quoteVersion.update({ where: { id: "qv_1" }, data: { snapshot: { lines: [1] } } })).rejects.toThrow(/frozen/);
    await expect(db.quoteVersion.update({ where: { id: "qv_1" }, data: { sent_at: null } })).rejects.toThrow(/frozen/);
    await expect(db.quoteVersion.delete({ where: { id: "qv_1" } })).rejects.toThrow(/cannot be deleted/);
    await db.quoteVersion.update({ where: { id: "qv_1" }, data: { pdf_key: "quotes/Q-00007/v3.pdf" } });
  });

  test("events are never deleted", async () => {
    await seedQuote(db);
    await declineQuote(db, now, { ref: "Q-00007", actor: "client", reason: "timing" });
    await expect(pg.exec("DELETE FROM outbox; DELETE FROM event;")).rejects.toThrow(/never deleted/);
  });
});
