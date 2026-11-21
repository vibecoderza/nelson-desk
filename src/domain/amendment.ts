// Amendments (brief 3.2). A client is free to design; Nelson has the final say. A change saves at once as a new
// design revision and joins the quote only when Nelson answers.
import { ok, refuse, type Actor, type Result } from "./result.ts";
import type { LineEvent } from "./line.ts";

export const AMENDMENT_STATES = ["waiting", "accepted", "suggested", "declined", "superseded"] as const;
export type AmendmentState = (typeof AMENDMENT_STATES)[number];

export type AmendmentEvent =
  | { type: "accept" }
  | { type: "suggest"; suggestion: string } // e.g. "15 mm, because laser needs 15 mm minimum"
  | { type: "decline"; reason: string }
  | { type: "take_suggestion" }
  | { type: "edit_again" }; // the client changed the design again before or after Nelson's answer

export type AmendmentOutcome = {
  state: AmendmentState;
  lineEvent: LineEvent | null; // what the quote line does as a result
  pinsNewRevision: boolean; // true when the line takes the amendment's design revision
  newVersion: boolean; // true when the answered round moves the quote version on
};

export function amendmentTransition(state: AmendmentState, event: AmendmentEvent, actor: Actor): Result<AmendmentOutcome> {
  const wrongActor = (by: Actor) => refuse("wrong_actor", `${event.type} is fired by ${by}, not ${actor}`);
  const wrongState = () => refuse("wrong_state", `${event.type} is not allowed from ${state}`);
  switch (event.type) {
    case "accept":
      if (actor !== "staff") return wrongActor("staff");
      if (state !== "waiting") return wrongState();
      return ok({ state: "accepted", lineEvent: { type: "nelson_accepted" }, pinsNewRevision: true, newVersion: true });
    case "suggest":
      if (actor !== "staff") return wrongActor("staff");
      if (state !== "waiting") return wrongState();
      if (!event.suggestion.trim()) return refuse("missing_suggestion", "a suggestion says what Nelson can make instead");
      return ok({ state: "suggested", lineEvent: { type: "nelson_suggested" }, pinsNewRevision: false, newVersion: true });
    case "decline":
      if (actor !== "staff") return wrongActor("staff");
      if (state !== "waiting") return wrongState();
      if (!event.reason.trim()) return refuse("missing_reason", "a declined change carries a reason");
      return ok({ state: "declined", lineEvent: { type: "nelson_declined" }, pinsNewRevision: false, newVersion: true });
    case "take_suggestion":
      if (actor !== "client") return wrongActor("client");
      if (state !== "suggested") return wrongState();
      return ok({ state: "accepted", lineEvent: { type: "client_took_suggestion" }, pinsNewRevision: true, newVersion: true });
    case "edit_again":
      if (actor !== "client") return wrongActor("client");
      if (state !== "waiting" && state !== "suggested") return wrongState();
      // A fresh amendment replaces this one. The line only moves if it was showing Nelson's suggestion.
      return ok({ state: "superseded", lineEvent: state === "suggested" ? { type: "client_changed" } : null, pinsNewRevision: false, newVersion: false });
  }
}
