// Where Nelson is, for the customer view. May be imported anywhere on the server.
import { inlineNelson, INLINE_DESK_KEY } from "../mock/nelson-customer.ts";
import { mockNelsonInUse } from "../mock/mode.ts";
import type { NelsonConfig } from "./client.ts";

export function nelsonConfig(env: Record<string, string | undefined> = process.env): NelsonConfig {
  if (mockNelsonInUse(env)) return { baseUrl: "http://nelson.mock", apiKey: INLINE_DESK_KEY, fetch: inlineNelson() };
  if (!env.NELSON_BASE_URL || !env.NELSON_API_KEY) throw new Error("NELSON_BASE_URL and NELSON_API_KEY are not set");
  return { baseUrl: env.NELSON_BASE_URL, apiKey: env.NELSON_API_KEY };
}
