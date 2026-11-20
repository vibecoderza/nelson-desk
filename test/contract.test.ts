// The contract with Nelson (brief section 6): the OpenAPI file, its schemas and its fixtures agree with each other,
// and the mock server behaves the way the contract says the real thing will.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import { CONTRACT_DIR, fixture, fixtureIndex, loadOpenApi, loadSchemas, schemaRefs, validator } from "@/contract/load.ts";
import { FROM_NELSON, TO_NELSON } from "@/events/envelope.ts";
import { sign, verify, SIGNATURE_HEADER } from "@/events/signing.ts";
import { deliveryEstimate, NelsonError, priceForCustomer, type PriceRequest } from "@/nelson/client.ts";
import { customerViewOf, markPaid, orderFromQuote, priceForStaff, writeOrderStatus, type OrderFromQuote } from "@/desk/nelson-staff.ts";
import { listen, MOCK_DESK_KEY, MOCK_STAFF_KEY, MOCK_WEBHOOK_SECRET } from "../mock/server.ts";

const { ajv, names } = loadSchemas();
const api = loadOpenApi();

describe("the contract files", () => {
  test("OpenAPI 3.1, and every schema it points at exists and compiles", () => {
    expect(api.openapi).toMatch(/^3\.1\./);
    const refs = schemaRefs(api);
    expect(refs.size).toBeGreaterThan(10);
    for (const ref of refs) {
      const [file, pointer] = ref.split("#");
      expect(names, ref).toContain(file);
      const resolved = ajv.getSchema(`https://contract.dearnelson.co.za/v1/${file}${pointer ? "#" + pointer : ""}`);
      expect(resolved, `${ref} does not resolve`).toBeTypeOf("function");
    }
  });

  test("every schema file is used by the contract or by another schema", () => {
    const used = new Set([...schemaRefs(api)].map((r) => r.split("#")[0]));
    used.add("common.json");
    for (const name of names) expect(used, `${name} is orphaned`).toContain(name);
  });

  test("every operation has an id, a tag and a response; every POST carries an Idempotency-Key", () => {
    const ids = new Set<string>();
    for (const [p, methods] of Object.entries(api.paths)) for (const [method, op] of Object.entries(methods)) {
      if (method === "servers") continue;
      expect(op.operationId, `${method} ${p}`).toBeTruthy();
      expect(ids.has(op.operationId!), `duplicate ${op.operationId}`).toBe(false);
      ids.add(op.operationId!);
      expect(op.tags?.length, `${method} ${p}`).toBe(1);
      expect(Object.keys(op.responses ?? {}).length).toBeGreaterThan(0);
      const versioned = p.startsWith("/api/v1/");
      if (method === "post" && versioned && op.operationId !== "postStudioToken") {
        expect(JSON.stringify(op.parameters ?? []), `${method} ${p} has no Idempotency-Key`).toContain("IdempotencyKey");
      }
    }
    // Brief section 11: the seam does not grow quietly. Adding a path means changing this number on purpose.
    expect(Object.keys(api.paths).filter((p) => api.paths[p]!.get?.tags?.[0] !== "desk" && api.paths[p]!.post?.tags?.[0] !== "desk").length).toBe(11);
  });

  test("every fixture satisfies its schema, and every fixture is indexed", async () => {
    const index = fixtureIndex();
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(path.join(CONTRACT_DIR, "fixtures")).filter((f) => f !== "index.json");
    expect(Object.keys(index.fixtures).sort()).toEqual(files.sort());
    for (const [file, schemaFile] of Object.entries(index.fixtures)) {
      expect(existsSync(path.join(CONTRACT_DIR, "fixtures", file))).toBe(true);
      const validate = validator(ajv, schemaFile);
      expect(validate(fixture(file)), `${file}: ${ajv.errorsText(validate.errors)}`).toBe(true);
    }
  });

  test("there is a fixture for every event type, in the direction the brief gives it", () => {
    const schema = fixture<never>("../schemas/event.json") as { properties: { type: { enum: string[] } }; "x-direction": { nelson_to_desk: string[]; desk_to_nelson: string[] } };
    expect(schema.properties.type.enum.sort()).toEqual([...FROM_NELSON, ...TO_NELSON].sort());
    expect(schema["x-direction"].nelson_to_desk).toEqual([...FROM_NELSON]);
    expect(schema["x-direction"].desk_to_nelson).toEqual([...TO_NELSON]);
    const have = Object.keys(fixtureIndex().fixtures).filter((f) => f.startsWith("event.")).map((f) => fixture<{ type: string }>(f).type);
    expect(have.sort()).toEqual([...FROM_NELSON, ...TO_NELSON].sort());
  });

  test("an event with the wrong data for its type is refused", () => {
    const validate = validator(ajv, "event.json");
    const paid = fixture<Record<string, unknown>>("event.order-paid.json");
    expect(validate({ ...paid, data: { order_ref: "x" } })).toBe(false);
    expect(validate({ ...paid, type: "order.refunded" })).toBe(false);
  });

  test("the price fixtures add up, so they can stand as test data", () => {
    type P = { lines: { quantity: number; unit_cents: number; setup_cents: number; line_total_cents: number; staff?: { unit_cost_cents: number; branding_cost_cents: number; margin_cents: number } }[]; delivery: { price_cents: number }; totals: { lines_cents: number; setup_cents: number; delivery_cents: number; total_cents: number }; staff?: { cost_cents: number; margin_cents: number } };
    for (const name of ["price-response.customer.json", "price-response.staff.json"]) {
      const p = fixture<P>(name);
      for (const l of p.lines) expect(l.line_total_cents).toBe(l.unit_cents * l.quantity);
      expect(p.totals.lines_cents).toBe(p.lines.reduce((n, l) => n + l.line_total_cents, 0));
      expect(p.totals.setup_cents).toBe(p.lines.reduce((n, l) => n + l.setup_cents, 0));
      expect(p.totals.delivery_cents).toBe(p.delivery.price_cents);
      expect(p.totals.total_cents).toBe(p.totals.lines_cents + p.totals.setup_cents + p.totals.delivery_cents);
    }
    const s = fixture<P>("price-response.staff.json");
    expect(s.staff!.cost_cents).toBe(s.lines.reduce((n, l) => n + (l.staff!.unit_cost_cents + l.staff!.branding_cost_cents) * l.quantity, 0));
    expect(s.staff!.margin_cents).toBe(s.lines.reduce((n, l) => n + l.staff!.margin_cents, 0));
    expect(fixture<{ total_cents: number }>("order-from-quote-request.json").total_cents).toBe(s.totals.total_cents);
  });

  test("one answer, two views: the customer fixture is the staff fixture with every staff key removed", () => {
    expect(customerViewOf(fixture("price-response.staff.json"))).toEqual(fixture("price-response.customer.json"));
  });
});

describe("signing", () => {
  const now = new Date("2026-11-21T08:14:05Z");
  const body = JSON.stringify(fixture("event.order-paid.json"));
  test("a signed body verifies; a changed body, a wrong secret, a stale stamp and a missing secret do not", () => {
    const header = sign(body, "s3cret", now);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verify(body, header, "s3cret", now)).toEqual({ ok: true });
    expect(verify(body + " ", header, "s3cret", now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verify(body, header, "other", now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verify(body, header, "s3cret", new Date(now.getTime() + 299_000))).toEqual({ ok: true });
    expect(verify(body, header, "s3cret", new Date(now.getTime() + 301_000))).toEqual({ ok: false, reason: "stale" });
    expect(verify(body, header, "s3cret", new Date(now.getTime() - 301_000))).toEqual({ ok: false, reason: "stale" });
    expect(verify(body, undefined, "s3cret", now)).toEqual({ ok: false, reason: "missing" });
    expect(verify(body, "v1=abc", "s3cret", now)).toEqual({ ok: false, reason: "malformed" });
    expect(verify(body, header, "", now)).toEqual({ ok: false, reason: "no_secret" });
    expect(() => sign(body, "", now)).toThrow();
  });
});

describe("the mock Nelson", () => {
  let server: Server, url: string, mock: Awaited<ReturnType<typeof listen>>["mock"];
  beforeAll(async () => ({ server, url, mock } = await listen()));
  afterAll(() => new Promise<void>((done) => server.close(() => done())));
  const desk = () => ({ baseUrl: url, apiKey: MOCK_DESK_KEY });
  const staff = () => ({ baseUrl: url, apiKey: MOCK_STAFF_KEY });
  const request = () => fixture<PriceRequest>("price-request.json");
  const refusal = async (p: Promise<unknown>) => { try { await p; } catch (e) { if (e instanceof NelsonError) return `${e.status} ${e.code}`; throw e; } return "ok"; };

  test("the customer price validates against the customer schema", async () => {
    const price = await priceForCustomer(desk(), request());
    expect(validator(ajv, "price-response-customer.json")(price)).toBe(true);
    expect(price.totals?.total_cents).toBe(1_753_500);
  });

  test("the staff view needs the staff key", async () => {
    expect(await refusal(priceForStaff(desk(), request()))).toBe("403 staff_scope_required");
    const price = await priceForStaff(staff(), request());
    expect(validator(ajv, "price-response-staff.json")(price)).toBe(true);
    expect(price.lines[0]!.staff!.supplier).toBeTruthy();
  });

  test("no key, a malformed request and a missing Idempotency-Key are refused", async () => {
    expect(await refusal(priceForCustomer({ baseUrl: url, apiKey: "nope" }, request()))).toBe("401 unauthorised");
    expect(await refusal(priceForCustomer(desk(), { ...request(), lines: [] }))).toBe("400 invalid_request");
    const res = await fetch(`${url}/api/v1/price`, { method: "POST", headers: { authorization: `Bearer ${MOCK_DESK_KEY}`, "content-type": "application/json" }, body: JSON.stringify(request()) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("idempotency_key_required");
  });

  test("a line Nelson cannot price comes back needs_human with no amounts", async () => {
    const r = request();
    const price = await priceForCustomer(desk(), { ...r, lines: [{ ...r.lines[0]!, line_id: "ql_unknown" }] });
    expect(price.lines[0]).toMatchObject({ line_id: "ql_unknown", status: "needs_human", unit_cents: null });
    expect(price.totals).toBeNull();
    expect(validator(ajv, "price-response-customer.json")(price)).toBe(true);
  });

  test("delivery estimate answers with a target date the Desk did not invent", async () => {
    const est = await deliveryEstimate(desk(), fixture("delivery-estimate-request.json"));
    expect(validator(ajv, "delivery-estimate-response.json")(est)).toBe(true);
  });

  test("an order from a quote: a stale price_version is 409 price_changed, the same key gives the same answer, and the two clicks go in order", async () => {
    const order = fixture<OrderFromQuote>("order-from-quote-request.json");
    expect(await refusal(orderFromQuote(desk(), { ...order, price_version: "pv_old" }, "idem-stale-0001"))).toBe("409 price_changed");
    const made = await orderFromQuote(desk(), order, "idem-order-0001");
    expect(validator(ajv, "order-from-quote-response.json")(made)).toBe(true);
    expect(await orderFromQuote(desk(), { ...order, price_version: "pv_old" }, "idem-order-0001")).toEqual(made); // replay: the first answer
    const ship = fixture<never>("order-status-request.dispatched.json");
    const place = fixture<never>("order-status-request.in-production.json");
    expect(await refusal(writeOrderStatus(staff(), made.order_ref, place, "idem-status-0000"))).toBe("409 wrong_state"); // not paid yet
    expect(await refusal(markPaid(desk(), made.order_ref, fixture("order-mark-paid-request.json"), "idem-paid-0000"))).toBe("403 staff_scope_required");
    expect((await markPaid(staff(), made.order_ref, fixture("order-mark-paid-request.json"), "idem-paid-0001")).pack_status).toBe("placed");
    expect(await refusal(markPaid(staff(), made.order_ref, fixture("order-mark-paid-request.json"), "idem-paid-0002"))).toBe("409 already_paid");
    expect(await refusal(writeOrderStatus(staff(), made.order_ref, ship, "idem-status-0001"))).toBe("409 wrong_state");
    expect((await writeOrderStatus(staff(), made.order_ref, place, "idem-status-0002")).pack_status).toBe("in_production");
    expect((await writeOrderStatus(staff(), made.order_ref, ship, "idem-status-0003")).pack_status).toBe("dispatched");
    expect(await refusal(writeOrderStatus(staff(), "ord_missing", place, "idem-status-0004"))).toBe("404 not_found");
  });

  test("Desk to Nelson events are accepted only when signed, and deduped by id", async () => {
    const raw = JSON.stringify(fixture("event.quote-sent.json"));
    const post = (signature: string) => fetch(`${url}/api/v1/events`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "ev-quote-sent-1" + signature.length, [SIGNATURE_HEADER]: signature }, body: raw });
    expect((await post("t=1,v1=" + "0".repeat(64))).status).toBe(401);
    const before = mock.received.length;
    expect((await post(sign(raw, MOCK_WEBHOOK_SECRET, new Date()))).status).toBe(202);
    const again = await fetch(`${url}/api/v1/events`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "ev-quote-sent-again", [SIGNATURE_HEADER]: sign(raw, MOCK_WEBHOOK_SECRET, new Date()) }, body: raw });
    expect(again.status).toBe(202);
    expect(mock.received.length).toBe(before + 1);
  });
});
