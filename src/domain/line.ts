// Quote line states (brief 3.2). One per line, shown to both sides in different words.
import { ok, refuse, type Actor, type Result } from "./result.ts";

export const LINE_STATES = ["agreed", "waiting_on_nelson", "nelson_suggests", "waiting_on_supplier"] as const;
export type LineState = (typeof LINE_STATES)[number];

export type LineEvent =
  | { type: "client_changed" } // a change in the customiser or in words
  | { type: "nelson_accepted" } // the line takes the new revision and is re-priced
  | { type: "nelson_suggested" } // the nearest thing Nelson can make
  | { type: "nelson_declined" } // the line keeps its agreed revision
  | { type: "client_took_suggestion" }
  | { type: "costing_requested" } // a cost Nelson does not hold
  | { type: "costing_answered" };

const MOVES: Record<LineEvent["type"], { from: readonly LineState[]; to: LineState; by: Actor }> = {
  client_changed: { from: ["agreed", "nelson_suggests"], to: "waiting_on_nelson", by: "client" },
  nelson_accepted: { from: ["waiting_on_nelson"], to: "agreed", by: "staff" },
  nelson_suggested: { from: ["waiting_on_nelson"], to: "nelson_suggests", by: "staff" },
  nelson_declined: { from: ["waiting_on_nelson"], to: "agreed", by: "staff" },
  client_took_suggestion: { from: ["nelson_suggests"], to: "agreed", by: "client" },
  costing_requested: { from: ["agreed", "waiting_on_nelson"], to: "waiting_on_supplier", by: "staff" },
  costing_answered: { from: ["waiting_on_supplier"], to: "agreed", by: "staff" },
};

export function lineTransition(state: LineState, event: LineEvent, actor: Actor): Result<LineState> {
  const move = MOVES[event.type];
  if (move.by !== actor) return refuse("wrong_actor", `${event.type} is fired by ${move.by}, not ${actor}`);
  if (!move.from.includes(state)) return refuse("wrong_state", `${event.type} is not allowed from ${state}`);
  return ok(move.to);
}

// Final means every line reads Agreed. A quote with no lines is never Final.
export const allAgreed = (lines: readonly LineState[]): boolean => lines.length > 0 && lines.every((s) => s === "agreed");

// What the quote is waiting on, for the Desk's totals bar and the Portal's status chip.
export function waitingOn(lines: readonly LineState[]): "nobody" | "nelson" | "client" | "supplier" {
  if (lines.includes("waiting_on_nelson")) return "nelson";
  if (lines.includes("waiting_on_supplier")) return "supplier";
  if (lines.includes("nelson_suggests")) return "client";
  return "nobody";
}

export const PORTAL_WORDS: Record<LineState, string> = {
  agreed: "Agreed",
  waiting_on_nelson: "Your change · waiting on Nelson",
  nelson_suggests: "Nelson suggests",
  waiting_on_supplier: "Due", // followed by the date the answer is due, e.g. "Due 2 Dec"
};

export const DESK_WORDS: Record<LineState, string> = {
  agreed: "Agreed",
  waiting_on_nelson: "Client change to answer",
  nelson_suggests: "Suggested, waiting on client",
  waiting_on_supplier: "Costing request out",
};
