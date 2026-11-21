// The quote (brief 3.2). Draft, Working, Final, Accepted, Declined, Expired.
// A version is immutable once sent; every answered round is the next version.
import { ok, refuse, type Actor, type Result } from "./result.ts";

export const QUOTE_STATES = ["draft", "working", "final", "accepted", "declined", "expired"] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];

export const DECLINE_REASONS = ["too_expensive", "timing", "went_elsewhere", "budget_cut", "just_exploring", "something_else"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export type Quote = { state: QuoteState; version: number };

// What the caller knows at the moment of the move. The machine never reads a clock or a database.
export type QuoteContext = {
  allLinesAgreed: boolean;
  lineCount: number;
  now: Date;
  validUntil: Date | null; // null until the quote is first sent
};

export type QuoteEvent =
  | { type: "send" } // Alan sends the draft: v1
  | { type: "line_changed" } // anyone changes a line: Final falls back to Working
  | { type: "round_answered" } // Alan answers the client's changes: the next version
  | { type: "paid" } // card webhook, or Alan matches an EFT. Deposit or full
  | { type: "decline"; reason: DeclineReason; budgetCents?: number; note?: string }
  | { type: "expire"; cause: "no_reply" | "validity" }
  | { type: "reopen" }; // declined, before the validity date: re-work
  // An expired quote comes back with { type: "round_answered" }: "Ask again" is a new version.

const pastValidity = (ctx: QuoteContext) => ctx.validUntil !== null && ctx.now.getTime() > ctx.validUntil.getTime();
const settled = (ctx: QuoteContext): QuoteState => (ctx.allLinesAgreed ? "final" : "working");

export function quoteTransition(quote: Quote, event: QuoteEvent, actor: Actor, ctx: QuoteContext): Result<Quote> {
  const { state, version } = quote;
  const wrongState = () => refuse("wrong_state", `${event.type} is not allowed from ${state}`);
  const wrongActor = (by: string) => refuse("wrong_actor", `${event.type} is fired by ${by}, not ${actor}`);

  switch (event.type) {
    case "send":
      if (actor !== "staff") return wrongActor("staff"); // anything about a price or a quote waits for Alan
      if (state !== "draft") return wrongState();
      if (ctx.lineCount === 0) return refuse("no_lines", "a quote with no lines cannot be sent");
      return ok({ state: settled(ctx), version: 1 });

    case "line_changed":
      if (actor === "auto") return wrongActor("staff or client");
      if (state !== "working" && state !== "final") return wrongState();
      return ok({ state: "working", version });

    case "round_answered":
      if (actor !== "staff") return wrongActor("staff");
      if (state !== "working" && state !== "final" && state !== "expired") return wrongState();
      return ok({ state: settled(ctx), version: version + 1 });

    case "paid":
      if (actor === "client") return wrongActor("auto or staff"); // a client cannot mark their own quote paid
      if (state !== "final") return refuse("not_final", "accept and pay unlocks only when every line reads Agreed");
      if (!ctx.allLinesAgreed) return refuse("not_final", "a line is no longer Agreed");
      return ok({ state: "accepted", version });

    case "decline":
      if (actor !== "client" && actor !== "staff") return wrongActor("client");
      if (state !== "working" && state !== "final") return wrongState();
      if (event.reason === "too_expensive" && !(Number.isInteger(event.budgetCents) && (event.budgetCents ?? 0) > 0)) {
        return refuse("budget_required", "too expensive asks for the budget figure");
      }
      return ok({ state: "declined", version });

    case "expire":
      if (actor !== "auto") return wrongActor("auto");
      if (state !== "working" && state !== "final") return wrongState();
      if (event.cause === "validity" && !pastValidity(ctx)) return refuse("still_valid", "the validity date has not passed");
      return ok({ state: "expired", version });

    case "reopen":
      if (actor !== "client" && actor !== "staff") return wrongActor("client or staff");
      if (state !== "declined") return wrongState();
      if (pastValidity(ctx)) return refuse("past_validity", "a declined quote re-opens only before its validity date");
      return ok({ state: "working", version });
  }
}

// What the client may do in each state (brief 3.2 table). The Portal reads this; it never decides on its own.
export function clientCan(state: QuoteState): { change: boolean; acceptAndPay: boolean; decline: boolean; ask: boolean; reopen: boolean } {
  return {
    change: state === "working" || state === "final",
    acceptAndPay: state === "final",
    decline: state === "working" || state === "final",
    ask: state === "working" || state === "final" || state === "expired",
    reopen: state === "declined",
  };
}

// Follow-ups (brief 3.2). Day 3 check-in, day 7 the video ask, day 10 the quote closes as "No reply".
// The days are a setting. A follow-up is due on its day and overdue the day after. Every one waits for Alan's send.
export type FollowUpSettings = { checkInDay: number; videoDay: number; closeDay: number };
export const DEFAULT_FOLLOW_UPS: FollowUpSettings = { checkInDay: 3, videoDay: 7, closeDay: 10 };
export type FollowUpKind = "check_in" | "video_ask";
export type FollowUpStatus = { kind: FollowUpKind; status: "not_yet" | "due" | "overdue" | "sent" };

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // South Africa has no daylight saving
const sastDay = (d: Date) => Math.floor((d.getTime() + SAST_OFFSET_MS) / 86_400_000);
// Whole calendar days in SAST between the send and now. Sent on Monday, Thursday is day 3.
export const daysSinceSent = (sentAt: Date, now: Date) => sastDay(now) - sastDay(sentAt);

export function followUps(sentAt: Date, now: Date, sent: readonly FollowUpKind[], s: FollowUpSettings = DEFAULT_FOLLOW_UPS): { followUps: FollowUpStatus[]; closeAsNoReply: boolean } {
  const day = daysSinceSent(sentAt, now);
  const status = (kind: FollowUpKind, dueDay: number): FollowUpStatus => ({
    kind,
    status: sent.includes(kind) ? "sent" : day < dueDay ? "not_yet" : day === dueDay ? "due" : "overdue",
  });
  return { followUps: [status("check_in", s.checkInDay), status("video_ask", s.videoDay)], closeAsNoReply: day >= s.closeDay };
}
