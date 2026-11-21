// Words both surfaces use for a quote. Customer-safe: nothing here names a supplier, a cost or a margin.
import type { DeclineReason, QuoteState } from "../domain/quote.ts";
import type { LineState } from "../domain/line.ts";
import type { Break } from "./book.ts";
import type { Tone } from "../ui/bits.tsx";

export const STATE_WORDS: Record<QuoteState, string> = { draft: "Draft", working: "Working", final: "Final", accepted: "Accepted", declined: "Declined", expired: "Expired" };
export const STATE_TONE: Record<QuoteState, Tone> = { draft: "plain", working: "warn", final: "ok", accepted: "ok", declined: "bad", expired: "plain" };
export const LINE_TONE: Record<LineState, Tone> = { agreed: "ok", waiting_on_nelson: "warn", nelson_suggests: "bad", waiting_on_supplier: "warn" };

export const DECLINE_WORDS: Record<DeclineReason, string> = {
  too_expensive: "Too expensive", timing: "Timing does not work", went_elsewhere: "Went with someone else",
  budget_cut: "Budget was cut", just_exploring: "Just exploring", something_else: "Something else",
};

// The break a quantity lands on: the highest one it reaches.
export const chosenBreak = (ladder: readonly Break[], quantity: number): number | null =>
  ladder.filter((b) => b.min_quantity <= quantity).map((b) => b.min_quantity).sort((a, b) => b - a)[0] ?? null;
