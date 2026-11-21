// A stand-in Nelson that answers inside the app, from the contract's own fixtures, for the screens built before
// Nelson's endpoints land. Customer view only. It follows mock/server.ts answer for answer (test/quote-screens
// holds the two side by side) and, like it, holds no price logic: every amount is a fixture.
import priceCustomer from "../../contract/fixtures/price-response.customer.json";
import needsHuman from "../../contract/fixtures/price-response.needs-human.customer.json";
import delivery from "../../contract/fixtures/delivery-estimate-response.json";

export const INLINE_DESK_KEY = "mock-desk-key";
export const INLINE_STAFF_KEY = "mock-staff-key";

type Answer = { status: number; body: unknown };
export type StaffAnswers = { priced: unknown; totals: unknown };

const json = (a: Answer) => new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function price(body: { lines?: { line_id: string; quantity: number }[] }, view: string, staff: StaffAnswers | null): Answer {
  const lines = body?.lines;
  if (!Array.isArray(lines) || !lines.length) return { status: 400, body: { error: "invalid_request" } };
  if (view === "staff" && !staff) return { status: 403, body: { error: "staff_scope_required" } };
  const known = new Set(priceCustomer.lines.map((l) => l.line_id));
  if (lines.some((l) => !known.has(l.line_id))) {
    const out = { ...needsHuman, view, lines: lines.map((l) => ({ ...needsHuman.lines[0], line_id: l.line_id, quantity: l.quantity, ...(view === "staff" ? { staff: null } : {}) })) };
    return { status: 200, body: view === "staff" ? { ...out, staff: staff!.totals } : out };
  }
  return { status: 200, body: view === "staff" ? staff!.priced : priceCustomer };
}

// `staff` is passed only by the Desk's own stand-in (src/desk/mock-nelson-staff.ts). Without it there is no staff
// view to give, whatever key is sent.
export function inlineNelson(staff: StaffAnswers | null = null): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const key = /^Bearer (.+)$/.exec(new Headers(init?.headers).get("authorization") ?? "")?.[1];
    if (key !== INLINE_DESK_KEY && key !== INLINE_STAFF_KEY) return json({ status: 401, body: { error: "unauthorised" } });
    let body: unknown;
    try { body = init?.body ? JSON.parse(String(init.body)) : undefined; } catch { return json({ status: 400, body: { error: "invalid_json" } }); }
    if (init?.method === "POST" && url.pathname === "/api/v1/price") {
      return json(price(body as never, url.searchParams.get("view") ?? "customer", key === INLINE_STAFF_KEY ? staff : null));
    }
    if (init?.method === "POST" && url.pathname === "/api/v1/delivery-estimate") return json({ status: 200, body: delivery });
    return json({ status: 404, body: { error: "not_found" } });
  };
}
