// Desk only. The costing check: what Nelson costed on a line, set against what the quote asks for, and who
// confirmed it. The Desk works nothing out here: every figure is Nelson's staff answer. A confirmation is held
// against the price version it was given on, so a cost that moves asks to be confirmed again.
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";
import type { Decoration } from "../nelson/client.ts";
import type { CostedBranding, StaffLine } from "./nelson-staff.ts";

export type CostingTick = { by: string; at: Date; price_version: string };
export type CostingBook = { ticks(quoteRef: string): Promise<Record<string, CostingTick>> };

// Sample confirmations: on Q-00007 the cap is confirmed and the tumbler is not, so both states can be seen.
const SAMPLE: Record<string, Record<string, CostingTick>> = {
  "Q-00007": { ql_cap01: { by: "Alan", at: new Date("2026-11-20T09:12:00Z"), price_version: "pv_2026-11-19_a1" } },
};
export function costingBook(): CostingBook {
  if (mockBookInUse()) return { ticks: async (ref) => SAMPLE[ref] ?? {} };
  throw new NotBuiltYet("The database costing book");
}

const METHOD_WORDS: Record<string, string> = { embroidery: "Embroidery", laser: "Laser engrave", screen: "Screen print", pad: "Pad print", digital: "Digital print", sublimation: "Sublimation", deboss: "Deboss", none: "Unbranded" };
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export function brandingWords(b: Decoration & { stitches?: number }): string {
  const parts = [`${METHOD_WORDS[b.method] ?? b.method} · ${b.position}`];
  if (b.colours) parts.push(`${b.colours} ${b.method === "embroidery" ? "thread" : "colour"}${b.colours === 1 ? "" : "s"}`);
  if (b.width_mm && b.height_mm) parts.push(`${b.width_mm} × ${b.height_mm} mm`);
  if (b.stitches) parts.push(`about ${grouped(b.stitches)} stitches`);
  return parts.join(" · ");
}

const same = (a: Decoration, b: Decoration) => a.position === b.position && a.method === b.method && (a.colours ?? 0) === (b.colours ?? 0) && (a.width_mm ?? 0) === (b.width_mm ?? 0) && (a.height_mm ?? 0) === (b.height_mm ?? 0);
// Does what Nelson costed match what the quote asks for? null when Nelson did not say what it costed.
export function brandingMatches(asked: Decoration[], costed: CostedBranding[] | undefined): boolean | null {
  if (!costed) return null;
  return asked.length === costed.length && asked.every((a) => costed.some((c) => same(a, c)));
}

export type LineCosting = {
  state: "confirmed" | "to_confirm" | "moved" | "no_cost";
  tick: { by: string; at: Date } | null;
  asked: string[]; costed: { words: string; unit_cost_cents: number; setup_cost_cents: number }[]; matches: boolean | null;
};
export function lineCosting(staff: StaffLine | null, asked: Decoration[], tick: CostingTick | undefined, priceVersion: string | null): LineCosting {
  const held = tick && tick.price_version === priceVersion;
  return {
    state: !staff ? "no_cost" : held ? "confirmed" : tick ? "moved" : "to_confirm",
    tick: staff && tick ? { by: tick.by, at: tick.at } : null,
    asked: asked.map(brandingWords),
    costed: (staff?.branding_costs ?? []).map((b) => ({ words: brandingWords(b), unit_cost_cents: b.unit_cost_cents, setup_cost_cents: b.setup_cost_cents })),
    matches: staff ? brandingMatches(asked, staff.branding_costs) : null,
  };
}
