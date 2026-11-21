// Desk only. The staff half of the stand-in Nelson: the staff price fixture never sits in a module the Portal
// can reach.
import priceStaff from "../../contract/fixtures/price-response.staff.json";
import { inlineNelson, INLINE_STAFF_KEY } from "../mock/nelson-customer.ts";
import { mockNelsonInUse } from "../mock/mode.ts";
import type { NelsonConfig } from "../nelson/client.ts";

const NOTHING_HELD = { cost_cents: 0, margin_cents: 0, margin_pct: 0 };

export function nelsonStaffConfig(env: Record<string, string | undefined> = process.env): NelsonConfig {
  if (mockNelsonInUse(env)) return { baseUrl: "http://nelson.mock", apiKey: INLINE_STAFF_KEY, fetch: inlineNelson({ priced: priceStaff, totals: NOTHING_HELD }) };
  if (!env.NELSON_BASE_URL || !env.NELSON_STAFF_API_KEY) throw new Error("NELSON_BASE_URL and NELSON_STAFF_API_KEY are not set");
  return { baseUrl: env.NELSON_BASE_URL, apiKey: env.NELSON_STAFF_API_KEY };
}
