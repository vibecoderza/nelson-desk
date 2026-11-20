// A stand-in for Nelson's side of the contract, answering from contract/fixtures. The Desk is built against this
// until Nelson's own endpoints land. It checks what the real thing will check: the key, the scope, the idempotency
// key and the request shape. It holds no price logic: every amount is a fixture.
//
//   npm run mock            listens on :4010
//   MOCK_PORT=4999 npm run mock
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fixture, loadSchemas, validator } from "../src/contract/load.ts";
import { sign, verify, SIGNATURE_HEADER } from "../src/events/signing.ts";

// Mock credentials. They open nothing real.
export const MOCK_DESK_KEY = "mock-desk-key";
export const MOCK_STAFF_KEY = "mock-staff-key";
export const MOCK_WEBHOOK_SECRET = "mock-webhook-secret";
export const MOCK_PRICE_VERSION = "pv_2026-11-19_a1";

type Json = Record<string, unknown>;
type Answer = { status: number; body: unknown };

export function createMockNelson(opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const { ajv } = loadSchemas();
  const check = (schemaFile: string, body: unknown): Answer | null => {
    const validate = validator(ajv, schemaFile);
    return validate(body) ? null : { status: 400, body: { error: "invalid_request", message: ajv.errorsText(validate.errors) } };
  };
  const seen = new Map<string, Answer>(); // idempotency: the same key returns the first answer
  const eventsSeen = new Set<string>();
  const orders = new Map<string, { pack_status: string; paid: boolean }>();
  const received: Json[] = []; // Desk to Nelson events, for tests to read

  const scopeOf = (req: IncomingMessage): "desk" | "staff" | null => {
    const key = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    return key === MOCK_STAFF_KEY ? "staff" : key === MOCK_DESK_KEY ? "desk" : null;
  };

  function route(req: IncomingMessage, url: URL, body: unknown, raw: string): Answer {
    const path = url.pathname;
    const scope = scopeOf(req);

    if (req.method === "POST" && path === "/api/v1/events") {
      const v = verify(raw, req.headers[SIGNATURE_HEADER] as string | undefined, MOCK_WEBHOOK_SECRET, now());
      if (!v.ok) return { status: 401, body: { error: "bad_signature", message: v.reason } };
      const bad = check("event.json", body);
      if (bad) return bad;
      const event = body as Json;
      if (!eventsSeen.has(event.id as string)) { eventsSeen.add(event.id as string); received.push(event); }
      return { status: 202, body: { ok: true } };
    }

    if (!scope) return { status: 401, body: { error: "unauthorised" } };
    const needStaff = (): Answer | null => (scope === "staff" ? null : { status: 403, body: { error: "staff_scope_required" } });

    if (req.method === "GET" && path === "/api/v1/spec") {
      const code = url.searchParams.get("code");
      return code ? { status: 200, body: { product: { code } } } : { status: 400, body: { error: "invalid_request" } };
    }

    if (req.method === "POST" && path === "/api/v1/price") {
      const bad = check("price-request.json", body);
      if (bad) return bad;
      const view = url.searchParams.get("view") ?? "customer";
      if (view === "staff") { const no = needStaff(); if (no) return no; }
      const known = new Set(fixture<{ lines: { line_id: string }[] }>("price-response.customer.json").lines.map((l) => l.line_id));
      const lines = (body as { lines: { line_id: string; quantity: number }[] }).lines;
      if (lines.some((l) => !known.has(l.line_id))) {
        // A line the fixtures do not price: no stock or no cost, so it needs a human.
        const answer = fixture<Json & { lines: Json[] }>("price-response.needs-human.customer.json");
        const out: Json = { ...answer, view, lines: lines.map((l) => ({ ...answer.lines[0], line_id: l.line_id, quantity: l.quantity, ...(view === "staff" ? { staff: null } : {}) })) };
        return { status: 200, body: view === "staff" ? { ...out, staff: { cost_cents: 0, margin_cents: 0, margin_pct: 0 } } : out };
      }
      return { status: 200, body: fixture(view === "staff" ? "price-response.staff.json" : "price-response.customer.json") };
    }

    if (req.method === "POST" && path === "/api/v1/delivery-estimate") {
      return check("delivery-estimate-request.json", body) ?? { status: 200, body: fixture("delivery-estimate-response.json") };
    }

    if (req.method === "POST" && path === "/api/v1/orders/from-quote") {
      const bad = check("order-from-quote-request.json", body);
      if (bad) return bad;
      if ((body as Json).price_version !== MOCK_PRICE_VERSION) return { status: 409, body: { ...fixture<Json>("price-changed.json"), price_version: MOCK_PRICE_VERSION } };
      const answer = fixture<{ order_ref: string }>("order-from-quote-response.json");
      orders.set(answer.order_ref, { pack_status: "ready", paid: false });
      return { status: 201, body: answer };
    }

    const order = /^\/api\/v1\/orders\/([^/]+)\/(mark-paid|status)$/.exec(path);
    if (req.method === "POST" && order) {
      const no = needStaff();
      if (no) return no;
      const ref = decodeURIComponent(order[1]!);
      const found = orders.get(ref);
      if (!found) return { status: 404, body: { error: "not_found" } };
      if (order[2] === "mark-paid") {
        const bad = check("order-mark-paid-request.json", body);
        if (bad) return bad;
        if (found.paid) return { status: 409, body: { error: "already_paid" } };
        found.paid = true;
        found.pack_status = "placed";
      } else {
        const bad = check("order-status-request.json", body);
        if (bad) return bad;
        const want = (body as { status: string }).status;
        // The mock has no proof step, so a paid pack ("placed") may go straight to production.
        const from = want === "in_production" ? ["placed", "proof_approved"] : ["in_production"];
        if (!found.paid || !from.includes(found.pack_status)) return { status: 409, body: { error: "wrong_state", message: `pack is ${found.pack_status}` } };
        found.pack_status = want;
      }
      return { status: 200, body: { order_ref: ref, pack_status: found.pack_status } };
    }

    return { status: 404, body: { error: "not_found" } };
  }

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const url = new URL(req.url ?? "/", "http://mock");
      let answer: Answer;
      let body: unknown = undefined;
      try { body = raw ? JSON.parse(raw) : undefined; } catch { body = Symbol("bad json"); }
      const key = req.headers["idempotency-key"] as string | undefined;
      // Events are checked for their signature every time and deduped by event id, so they skip the replay cache.
      const idem = key && url.pathname !== "/api/v1/events" ? `${req.method} ${url.pathname} ${key}` : null;
      if (typeof body === "symbol") answer = { status: 400, body: { error: "invalid_json" } };
      else if (req.method === "POST" && (!key || key.length < 8)) answer = { status: 400, body: { error: "idempotency_key_required" } };
      else if (idem && seen.has(idem)) answer = seen.get(idem)!;
      else {
        answer = route(req, url, body, raw);
        if (idem && answer.status < 500) seen.set(idem, answer);
      }
      res.writeHead(answer.status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(answer.body));
    });
  };

  // Send a Nelson to Desk event the way Nelson will: signed, with an idempotency key.
  async function emit(deskWebhookUrl: string, eventFixture: string, secret = MOCK_WEBHOOK_SECRET): Promise<Response> {
    const raw = JSON.stringify(fixture(eventFixture));
    return fetch(deskWebhookUrl, { method: "POST", headers: { "content-type": "application/json", [SIGNATURE_HEADER]: sign(raw, secret, now()), "idempotency-key": (JSON.parse(raw) as { id: string }).id }, body: raw });
  }

  return { handler, emit, received, orders };
}

export async function listen(port = 0): Promise<{ server: Server; url: string; mock: ReturnType<typeof createMockNelson> }> {
  const mock = createMockNelson();
  const server = createServer(mock.handler);
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock server has no port");
  return { server, url: `http://127.0.0.1:${address.port}`, mock };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { url } = await listen(Number(process.env.MOCK_PORT ?? 4010));
  console.log(`Mock Nelson on ${url}. Keys: ${MOCK_DESK_KEY} (customer view), ${MOCK_STAFF_KEY} (staff view).`);
}
