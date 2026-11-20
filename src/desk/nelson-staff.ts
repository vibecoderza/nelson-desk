// Desk only. The staff view of the price, and the order writes that need the staff-scope key.
// Portal code may not import this file (test/exposure-portal.test.ts walks the imports).
import { nelsonCall, type CustomerPrice, type NelsonConfig, type PricedLine, type PriceRequest } from "../nelson/client.ts";

export type StaffLine = {
  supplier: string; supplier_code: string; stock: number; incoming_stock: { quantity: number; due: string }[];
  unit_cost_cents: number; branding_cost_cents: number; markup_applied_pct: number; margin_cents: number; margin_pct: number;
};
export type StaffPrice = Omit<CustomerPrice, "view" | "lines"> & {
  view: "staff";
  lines: (PricedLine & { staff: StaffLine | null })[];
  staff: { cost_cents: number; margin_cents: number; margin_pct: number };
};

// cfg.apiKey must be the staff-scope key (NELSON_STAFF_API_KEY).
export const priceForStaff = (cfg: NelsonConfig, request: PriceRequest) => nelsonCall<StaffPrice>(cfg, "POST", "/api/v1/price?view=staff", request);

// One answer, two views: the customer view is the staff view with every `staff` key removed. Used when a version
// is sent, so the snapshot the Portal reads and the snapshot the Desk reads come from the same call.
export function customerViewOf(price: StaffPrice): CustomerPrice {
  const { staff: _totals, lines, ...rest } = price;
  return { ...rest, view: "customer", lines: lines.map(({ staff: _line, ...line }) => line) };
}

export type OrderFromQuote = {
  quote_ref: string; version: number; price_version: string; client_id: string;
  lines: { line_id: string; product_code: string; colour: string; quantity: number; design: { ref: string; rev: number }; unit_cents: number; setup_cents: number }[];
  contact: { name: string; email: string; phone?: string };
  ship_to: PriceRequest["delivery_address"] & object;
  delivery: { service: "economy" | "express"; price_cents: number };
  payment: { kind: "deposit" | "full"; amount_cents: number };
  total_cents: number;
};
export const orderFromQuote = (cfg: NelsonConfig, order: OrderFromQuote, idempotencyKey: string) =>
  nelsonCall<{ order_ref: string; pay_url: string; pay_url_expires_at: string }>(cfg, "POST", "/api/v1/orders/from-quote", order, idempotencyKey);

export const markPaid = (cfg: NelsonConfig, orderRef: string, body: { method: "eft"; amount_cents: number; reference: string; received_on: string; marked_by: string }, idempotencyKey: string) =>
  nelsonCall<{ order_ref: string; pack_status: string }>(cfg, "POST", `/api/v1/orders/${encodeURIComponent(orderRef)}/mark-paid`, body, idempotencyKey);

export type StatusWrite =
  | { status: "in_production"; marked_by: string; supplier_refs?: { pack_id: string; supplier_ref: string }[] }
  | { status: "dispatched"; marked_by: string; waybill: { courier: string; service?: string; number: string; cartons?: number; tracking_url?: string } };
export const writeOrderStatus = (cfg: NelsonConfig, orderRef: string, body: StatusWrite, idempotencyKey: string) =>
  nelsonCall<{ order_ref: string; pack_status: string }>(cfg, "POST", `/api/v1/orders/${encodeURIComponent(orderRef)}/status`, body, idempotencyKey);
