// The Desk's one way to talk to Nelson. Customer view only: this file may be imported anywhere on the server.
// The staff view lives in src/desk/nelson-staff.ts, which Portal code may not import.
import { assertPortalSafe } from "../exposure/private.ts";
import { newId } from "../events/envelope.ts";

export type NelsonConfig = { baseUrl: string; apiKey: string; fetch?: typeof fetch };

export class NelsonError extends Error {
  constructor(readonly status: number, readonly code: string, readonly body: unknown) {
    super(`Nelson answered ${status} ${code}`);
  }
}

export async function nelsonCall<T>(cfg: NelsonConfig, method: "GET" | "POST", path: string, body?: unknown, idempotencyKey = newId("idem")): Promise<T> {
  const res = await (cfg.fetch ?? fetch)(new URL(path, cfg.baseUrl), {
    method,
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      ...(method === "POST" ? { "content-type": "application/json", "idempotency-key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new NelsonError(res.status, (json as { error?: string } | null)?.error ?? "error", json);
  return json as T;
}

export type Address = { line1?: string; line2?: string; suburb?: string; city: string; province: string; postal_code: string; country: "ZA" };
export type Decoration = { position: string; method: string; colours?: number; width_mm?: number; height_mm?: number };
export type PriceRequestLine = {
  line_id: string; product_code: string; colour: string; quantity: number; decoration: Decoration[];
  design?: { ref: string; rev: number };
  manual_cost?: { costing_request: string; breaks: { min_quantity: number; unit_cost_cents: number }[]; setup_cost_cents?: number };
};
export type PriceRequest = { quote_ref?: string; currency: "ZAR"; lines: PriceRequestLine[]; delivery_address?: Address };

export type PricedLine = {
  line_id: string; status: "priced" | "quote_only" | "needs_human"; below_floor: boolean; quantity: number;
  unit_cents: number | null; setup_cents: number | null; line_total_cents: number | null;
  ladder: { min_quantity: number; unit_cents: number }[];
};
export type PriceTotals = { lines_cents: number; setup_cents: number; delivery_cents: number; total_cents: number };
export type CustomerPrice = {
  view: "customer"; price_version: string; currency: "ZAR"; valid_until: string; lines: PricedLine[];
  delivery: { service: "economy" | "express"; price_cents: number } | null; totals: PriceTotals | null;
};

// Every price the Portal shows comes through here. The answer is checked before it is returned: if Nelson ever
// sent a staff field on the customer view, this throws instead of passing it on.
export async function priceForCustomer(cfg: NelsonConfig, request: PriceRequest): Promise<CustomerPrice> {
  const price = await nelsonCall<CustomerPrice>(cfg, "POST", "/api/v1/price", request);
  if (price.view !== "customer") throw new Error("Nelson answered the customer price call with another view");
  return assertPortalSafe(price, "the customer price");
}

export type DeliveryEstimate = {
  production_days: number; transit_days: number; target_date: string; carton_count: number; lead_time_basis: "default" | "product";
  freight_options: { service: "economy" | "express"; price_cents: number; transit_days: number; target_date: string }[];
};
export const deliveryEstimate = (cfg: NelsonConfig, request: { lines: { product_code: string; quantity: number }[]; delivery_address: Address; sign_date: string }) =>
  nelsonCall<DeliveryEstimate>(cfg, "POST", "/api/v1/delivery-estimate", request);
