import { describe, expect, test } from "vitest";
import { allAgreed, lineTransition, waitingOn, LINE_STATES, type LineState } from "@/domain/line.ts";
import { amendmentTransition } from "@/domain/amendment.ts";
import { clientCan, daysSinceSent, followUps, quoteTransition, QUOTE_STATES, type Quote, type QuoteContext, type QuoteEvent } from "@/domain/quote.ts";
import { expectedPackStatus, orderEventForPackStatus, orderTransition, ORDER_STATES, type Order, type OrderEvent } from "@/domain/order.ts";
import { buildEvidence, evidenceIsIntact, proofTransition, PROOF_CHECKS, sha256Hex, type Proof } from "@/domain/proof.ts";
import { clientMay } from "@/domain/roles.ts";
import type { Actor } from "@/domain/result.ts";

const value = <T>(r: { ok: true; value: T } | { ok: false; code: string }): T => {
  if (!r.ok) throw new Error(`refused: ${r.code}`);
  return r.value;
};
const code = (r: { ok: boolean; code?: string }) => (r.ok ? "ok" : r.code);

describe("quote line", () => {
  test("a client change waits on Nelson, and each of Nelson's three answers lands where the brief says", () => {
    const waiting = value(lineTransition("agreed", { type: "client_changed" }, "client"));
    expect(waiting).toBe("waiting_on_nelson");
    expect(value(lineTransition(waiting, { type: "nelson_accepted" }, "staff"))).toBe("agreed");
    expect(value(lineTransition(waiting, { type: "nelson_declined" }, "staff"))).toBe("agreed");
    const suggested = value(lineTransition(waiting, { type: "nelson_suggested" }, "staff"));
    expect(suggested).toBe("nelson_suggests");
    expect(value(lineTransition(suggested, { type: "client_took_suggestion" }, "client"))).toBe("agreed");
    expect(value(lineTransition(suggested, { type: "client_changed" }, "client"))).toBe("waiting_on_nelson");
  });

  test("a costing request parks the line on the supplier until the answer is in", () => {
    const out = value(lineTransition("agreed", { type: "costing_requested" }, "staff"));
    expect(out).toBe("waiting_on_supplier");
    expect(code(lineTransition(out, { type: "client_changed" }, "client"))).toBe("wrong_state");
    expect(value(lineTransition(out, { type: "costing_answered" }, "staff"))).toBe("agreed");
  });

  test("a client never answers their own change, and Nelson never takes its own suggestion", () => {
    expect(code(lineTransition("waiting_on_nelson", { type: "nelson_accepted" }, "client"))).toBe("wrong_actor");
    expect(code(lineTransition("nelson_suggests", { type: "client_took_suggestion" }, "staff"))).toBe("wrong_actor");
  });

  test("every state and event pair either moves to a known state or is refused", () => {
    const events = ["client_changed", "nelson_accepted", "nelson_suggested", "nelson_declined", "client_took_suggestion", "costing_requested", "costing_answered"] as const;
    for (const s of LINE_STATES) for (const e of events) for (const a of ["auto", "staff", "client"] as Actor[]) {
      const r = lineTransition(s, { type: e }, a);
      if (r.ok) expect(LINE_STATES).toContain(r.value);
    }
  });

  test("Final means every line Agreed; an empty quote is never Final", () => {
    expect(allAgreed(["agreed", "agreed"])).toBe(true);
    expect(allAgreed(["agreed", "nelson_suggests"])).toBe(false);
    expect(allAgreed([])).toBe(false);
    expect(waitingOn(["agreed", "nelson_suggests"])).toBe("client");
    expect(waitingOn(["nelson_suggests", "waiting_on_nelson"])).toBe("nelson");
    expect(waitingOn(["agreed", "waiting_on_supplier"])).toBe("supplier");
    expect(waitingOn(["agreed"])).toBe("nobody");
  });
});

describe("amendment", () => {
  test("accept pins the new revision and moves the version on", () => {
    const out = value(amendmentTransition("waiting", { type: "accept" }, "staff"));
    expect(out).toEqual({ state: "accepted", lineEvent: { type: "nelson_accepted" }, pinsNewRevision: true, newVersion: true });
  });
  test("suggest and decline keep the agreed revision; both need words", () => {
    expect(value(amendmentTransition("waiting", { type: "suggest", suggestion: "15 mm" }, "staff")).pinsNewRevision).toBe(false);
    expect(value(amendmentTransition("waiting", { type: "decline", reason: "below the laser minimum" }, "staff")).pinsNewRevision).toBe(false);
    expect(code(amendmentTransition("waiting", { type: "suggest", suggestion: " " }, "staff"))).toBe("missing_suggestion");
    expect(code(amendmentTransition("waiting", { type: "decline", reason: "" }, "staff"))).toBe("missing_reason");
  });
  test("the client takes a suggestion or edits again; only Nelson answers", () => {
    expect(value(amendmentTransition("suggested", { type: "take_suggestion" }, "client")).state).toBe("accepted");
    expect(value(amendmentTransition("suggested", { type: "edit_again" }, "client"))).toMatchObject({ state: "superseded", lineEvent: { type: "client_changed" }, newVersion: false });
    expect(value(amendmentTransition("waiting", { type: "edit_again" }, "client")).lineEvent).toBeNull();
    expect(code(amendmentTransition("waiting", { type: "accept" }, "client"))).toBe("wrong_actor");
    expect(code(amendmentTransition("accepted", { type: "decline", reason: "x" }, "staff"))).toBe("wrong_state");
  });
  test("every line event an amendment emits is a legal move for the line state it is fired from", () => {
    const a = value(amendmentTransition("waiting", { type: "accept" }, "staff"));
    expect(lineTransition("waiting_on_nelson", a.lineEvent!, "staff").ok).toBe(true);
    const t = value(amendmentTransition("suggested", { type: "take_suggestion" }, "client"));
    expect(lineTransition("nelson_suggests", t.lineEvent!, "client").ok).toBe(true);
  });
});

describe("quote", () => {
  const at = (iso: string) => new Date(iso);
  const ctx = (over: Partial<QuoteContext> = {}): QuoteContext => ({ allLinesAgreed: true, lineCount: 2, now: at("2026-11-20T08:00:00Z"), validUntil: at("2026-12-02T21:59:59Z"), ...over });
  const draft: Quote = { state: "draft", version: 0 };

  test("sending makes v1; it is Final only when every line is Agreed", () => {
    expect(value(quoteTransition(draft, { type: "send" }, "staff", ctx()))).toEqual({ state: "final", version: 1 });
    expect(value(quoteTransition(draft, { type: "send" }, "staff", ctx({ allLinesAgreed: false })))).toEqual({ state: "working", version: 1 });
    expect(code(quoteTransition(draft, { type: "send" }, "staff", ctx({ lineCount: 0 })))).toBe("no_lines");
    expect(code(quoteTransition(draft, { type: "send" }, "auto", ctx()))).toBe("wrong_actor");
    expect(code(quoteTransition(draft, { type: "send" }, "client", ctx()))).toBe("wrong_actor");
  });

  test("a changed line drops Final back to Working, and an answered round is the next version", () => {
    const working = value(quoteTransition({ state: "final", version: 2 }, { type: "line_changed" }, "client", ctx()));
    expect(working).toEqual({ state: "working", version: 2 });
    expect(value(quoteTransition(working, { type: "round_answered" }, "staff", ctx()))).toEqual({ state: "final", version: 3 });
    expect(value(quoteTransition(working, { type: "round_answered" }, "staff", ctx({ allLinesAgreed: false })))).toEqual({ state: "working", version: 3 });
  });

  test("payment is accepted only from Final, and never on the client's say-so", () => {
    expect(value(quoteTransition({ state: "final", version: 3 }, { type: "paid" }, "auto", ctx()))).toEqual({ state: "accepted", version: 3 });
    expect(value(quoteTransition({ state: "final", version: 3 }, { type: "paid" }, "staff", ctx())).state).toBe("accepted"); // EFT matched by Alan
    expect(code(quoteTransition({ state: "working", version: 3 }, { type: "paid" }, "auto", ctx()))).toBe("not_final");
    expect(code(quoteTransition({ state: "final", version: 3 }, { type: "paid" }, "auto", ctx({ allLinesAgreed: false })))).toBe("not_final");
    expect(code(quoteTransition({ state: "final", version: 3 }, { type: "paid" }, "client", ctx()))).toBe("wrong_actor");
  });

  test("a decline always carries a reason, and too expensive carries the budget", () => {
    const q: Quote = { state: "final", version: 1 };
    expect(value(quoteTransition(q, { type: "decline", reason: "timing" }, "client", ctx())).state).toBe("declined");
    expect(code(quoteTransition(q, { type: "decline", reason: "too_expensive" }, "client", ctx()))).toBe("budget_required");
    expect(code(quoteTransition(q, { type: "decline", reason: "too_expensive", budgetCents: 0 }, "client", ctx()))).toBe("budget_required");
    expect(value(quoteTransition(q, { type: "decline", reason: "too_expensive", budgetCents: 3_000_000 }, "client", ctx())).state).toBe("declined");
  });

  test("a declined quote re-opens before its validity date and not after", () => {
    const q: Quote = { state: "declined", version: 2 };
    expect(value(quoteTransition(q, { type: "reopen" }, "client", ctx()))).toEqual({ state: "working", version: 2 });
    expect(code(quoteTransition(q, { type: "reopen" }, "client", ctx({ now: at("2026-12-03T00:00:00Z") })))).toBe("past_validity");
  });

  test("expiry is automatic; an expired quote comes back only as a new version", () => {
    const q: Quote = { state: "working", version: 1 };
    expect(code(quoteTransition(q, { type: "expire", cause: "validity" }, "auto", ctx()))).toBe("still_valid");
    expect(value(quoteTransition(q, { type: "expire", cause: "validity" }, "auto", ctx({ now: at("2026-12-03T00:00:00Z") }))).state).toBe("expired");
    const expired = value(quoteTransition(q, { type: "expire", cause: "no_reply" }, "auto", ctx()));
    expect(code(quoteTransition(q, { type: "expire", cause: "no_reply" }, "staff", ctx()))).toBe("wrong_actor");
    expect(code(quoteTransition(expired, { type: "reopen" }, "client", ctx()))).toBe("wrong_state");
    expect(value(quoteTransition(expired, { type: "round_answered" }, "staff", ctx()))).toEqual({ state: "final", version: 2 });
  });

  test("Accepted is the end: nothing moves an accepted quote", () => {
    const events: QuoteEvent[] = [{ type: "send" }, { type: "line_changed" }, { type: "round_answered" }, { type: "paid" }, { type: "decline", reason: "timing" }, { type: "expire", cause: "no_reply" }, { type: "reopen" }];
    for (const e of events) for (const a of ["auto", "staff", "client"] as Actor[]) expect(quoteTransition({ state: "accepted", version: 3 }, e, a, ctx()).ok).toBe(false);
  });

  test("the version never goes down and every result is a known state", () => {
    const events: QuoteEvent[] = [{ type: "send" }, { type: "line_changed" }, { type: "round_answered" }, { type: "paid" }, { type: "decline", reason: "timing" }, { type: "expire", cause: "no_reply" }, { type: "reopen" }];
    for (const s of QUOTE_STATES) for (const e of events) for (const a of ["auto", "staff", "client"] as Actor[]) for (const agreed of [true, false]) {
      const r = quoteTransition({ state: s, version: 4 }, e, a, ctx({ allLinesAgreed: agreed }));
      if (r.ok) { expect(QUOTE_STATES).toContain(r.value.state); expect(r.value.version).toBeGreaterThanOrEqual(s === "draft" ? 1 : 4); }
    }
  });

  test("the client's buttons follow the state", () => {
    expect(clientCan("draft")).toEqual({ change: false, acceptAndPay: false, decline: false, ask: false, reopen: false });
    expect(clientCan("working").acceptAndPay).toBe(false);
    expect(clientCan("final").acceptAndPay).toBe(true);
    expect(clientCan("declined").reopen).toBe(true);
    expect(clientCan("expired").ask).toBe(true);
  });

  test("follow-ups: due on the day, overdue the day after, closed at day 10, counted in SAST", () => {
    const sent = at("2026-11-16T07:00:00Z"); // Monday 09:00 SAST
    expect(daysSinceSent(sent, at("2026-11-16T21:59:00Z"))).toBe(0); // 23:59 SAST the same day
    expect(daysSinceSent(sent, at("2026-11-16T22:01:00Z"))).toBe(1); // 00:01 SAST Tuesday
    expect(followUps(sent, at("2026-11-18T10:00:00Z"), []).followUps[0]).toEqual({ kind: "check_in", status: "not_yet" });
    expect(followUps(sent, at("2026-11-19T10:00:00Z"), []).followUps[0]!.status).toBe("due");
    expect(followUps(sent, at("2026-11-20T10:00:00Z"), []).followUps[0]!.status).toBe("overdue");
    expect(followUps(sent, at("2026-11-20T10:00:00Z"), ["check_in"]).followUps[0]!.status).toBe("sent");
    expect(followUps(sent, at("2026-11-23T10:00:00Z"), ["check_in"]).followUps[1]).toEqual({ kind: "video_ask", status: "due" });
    expect(followUps(sent, at("2026-11-25T10:00:00Z"), []).closeAsNoReply).toBe(false);
    expect(followUps(sent, at("2026-11-26T10:00:00Z"), []).closeAsNoReply).toBe(true);
    expect(followUps(sent, at("2026-11-21T10:00:00Z"), [], { checkInDay: 5, videoDay: 9, closeDay: 14 }).followUps[0]!.status).toBe("due");
  });
});

describe("order", () => {
  const start: Order = { state: "paid", onHold: false };
  const path: [OrderEvent, Actor, string][] = [
    [{ type: "proof_arrived" }, "auto", "proof_with_nelson"],
    [{ type: "proof_approved" }, "staff", "proof_with_client"],
    [{ type: "proof_signed" }, "client", "signed"],
    [{ type: "supplier_order_placed" }, "staff", "in_production"],
    [{ type: "waybill_saved", waybill: "WB-123" }, "staff", "dispatched"],
    [{ type: "delivery_confirmed" }, "auto", "delivered"],
  ];

  test("the happy path runs Paid to Delivered in order", () => {
    let order = start;
    for (const [event, actor, state] of path) { order = value(orderTransition(order, event, actor)); expect(order.state).toBe(state); }
  });

  test("forward only: no step can be skipped and nothing after Signed goes back", () => {
    const order_ = (state: Order["state"]): Order => ({ state, onHold: false });
    const rank = (s: string) => ORDER_STATES.indexOf(s as Order["state"]);
    for (const s of ORDER_STATES) for (const [event, actor] of path) {
      const r = orderTransition(order_(s), event, actor);
      if (r.ok) expect(rank(r.value.state) - rank(s)).toBeLessThanOrEqual(1);
      if (r.ok && rank(s) >= rank("signed")) expect(rank(r.value.state)).toBeGreaterThan(rank(s));
    }
    expect(code(orderTransition(order_("paid"), { type: "supplier_order_placed" }, "staff"))).toBe("wrong_state");
    expect(code(orderTransition(order_("signed"), { type: "proof_returned" }, "client"))).toBe("wrong_state");
    expect(value(orderTransition(order_("proof_with_client"), { type: "proof_returned" }, "client")).state).toBe("proof_with_nelson");
  });

  test("the two clicks that are the news are Alan's, and dispatch needs a waybill", () => {
    expect(code(orderTransition({ state: "signed", onHold: false }, { type: "supplier_order_placed" }, "auto"))).toBe("wrong_actor");
    expect(code(orderTransition({ state: "in_production", onHold: false }, { type: "waybill_saved", waybill: "WB-1" }, "auto"))).toBe("wrong_actor");
    expect(code(orderTransition({ state: "in_production", onHold: false }, { type: "waybill_saved", waybill: " " }, "staff"))).toBe("missing_waybill");
    expect(code(orderTransition({ state: "proof_with_client", onHold: false }, { type: "proof_signed" }, "staff"))).toBe("wrong_actor");
  });

  test("an order on hold does not move until released; a hold and a cancellation both carry a reason", () => {
    const held = value(orderTransition({ state: "signed", onHold: false }, { type: "hold", reason: "Stock short" }, "staff"));
    expect(held).toEqual({ state: "signed", onHold: true });
    expect(code(orderTransition(held, { type: "supplier_order_placed" }, "staff"))).toBe("on_hold");
    expect(code(orderTransition(held, { type: "hold", reason: "again" }, "staff"))).toBe("already_on_hold");
    expect(value(orderTransition(value(orderTransition(held, { type: "release" }, "staff")), { type: "supplier_order_placed" }, "staff")).state).toBe("in_production");
    expect(code(orderTransition(start, { type: "hold", reason: "" }, "staff"))).toBe("missing_reason");
    expect(code(orderTransition(start, { type: "cancel", reason: "" }, "staff"))).toBe("missing_reason");
    expect(value(orderTransition(held, { type: "cancel", reason: "Client asked" }, "staff"))).toEqual({ state: "cancelled", onHold: false });
    expect(code(orderTransition({ state: "delivered", onHold: false }, { type: "cancel", reason: "late" }, "staff"))).toBe("wrong_state");
    expect(code(orderTransition(start, { type: "cancel", reason: "changed my mind" }, "client"))).toBe("wrong_actor");
  });

  test("the order mirrors Nelson's pack status and never writes it", () => {
    expect(expectedPackStatus("paid")).toBe("placed");
    expect(expectedPackStatus("signed")).toBe("proof_approved");
    expect(expectedPackStatus("dispatched")).toBe("dispatched");
    expect(orderEventForPackStatus("delivered")).toEqual({ type: "delivery_confirmed" });
    expect(orderEventForPackStatus("cancelled")?.type).toBe("cancel");
    expect(orderEventForPackStatus("in_production")).toBeNull();
  });
});

describe("proof", () => {
  const sheet = sha256Hex("sheet-1");
  const withClient: Proof = { state: "with_client", round: 1, sheetSha256: sheet };
  const sign = (over: object = {}) => ({ type: "sign" as const, role: "owner" as const, name: "Holly Mokoena", signature: "Holly Mokoena", checks: PROOF_CHECKS, sheetSha256: sheet, ...over });

  test("sheet in, Nelson approves, client signs", () => {
    const p1 = value(proofTransition({ state: "awaiting_sheet", round: 0, sheetSha256: null }, { type: "sheet_uploaded", sheetSha256: sheet }, "auto"));
    expect(p1).toEqual({ state: "with_nelson", round: 1, sheetSha256: sheet });
    const p2 = value(proofTransition(p1, { type: "approve" }, "staff"));
    expect(value(proofTransition(p2, sign(), "client")).state).toBe("signed");
  });

  test("nothing is signed without all four ticks, a name, a signature, the Owner and the current sheet", () => {
    expect(code(proofTransition(withClient, sign({ checks: PROOF_CHECKS.slice(0, 3) }), "client"))).toBe("checks_incomplete");
    expect(code(proofTransition(withClient, sign({ name: " " }), "client"))).toBe("missing_name");
    expect(code(proofTransition(withClient, sign({ signature: "" }), "client"))).toBe("missing_signature");
    expect(code(proofTransition(withClient, sign({ role: "buyer" }), "client"))).toBe("not_allowed");
    expect(code(proofTransition(withClient, sign({ role: "viewer" }), "client"))).toBe("not_allowed");
    expect(code(proofTransition(withClient, sign({ sheetSha256: sha256Hex("sheet-0") }), "client"))).toBe("sheet_changed");
    expect(code(proofTransition(withClient, sign(), "staff"))).toBe("wrong_actor");
    expect(code(proofTransition({ ...withClient, state: "with_nelson" }, sign(), "client"))).toBe("wrong_state");
  });

  test("a change request or a send-back waits for a new sheet, and a new sheet restarts the proof", () => {
    const back = value(proofTransition(withClient, { type: "request_change", note: "Logo 5 mm lower" }, "client"));
    expect(back).toEqual({ state: "awaiting_sheet", round: 1, sheetSha256: null });
    expect(code(proofTransition(withClient, { type: "request_change", note: "" }, "client"))).toBe("missing_note");
    const sheet2 = sha256Hex("sheet-2");
    expect(value(proofTransition(back, { type: "sheet_uploaded", sheetSha256: sheet2 }, "auto"))).toEqual({ state: "with_nelson", round: 2, sheetSha256: sheet2 });
    expect(value(proofTransition({ ...withClient, state: "with_nelson" }, { type: "send_back", note: "Wrong thread" }, "staff")).state).toBe("awaiting_sheet");
  });

  test("a signed proof is locked", () => {
    const signed: Proof = { ...withClient, state: "signed" };
    expect(code(proofTransition(signed, { type: "sheet_uploaded", sheetSha256: sheet }, "auto"))).toBe("locked");
    expect(code(proofTransition(signed, { type: "request_change", note: "x" }, "client"))).toBe("wrong_state");
    expect(code(proofTransition(signed, sign(), "client"))).toBe("wrong_state");
  });

  test("the evidence record fingerprints the sheet and itself", () => {
    const evidence = buildEvidence({ proofRef: "PP-1042", round: 1, name: "Holly Mokoena", signature: "Holly Mokoena", signedAt: new Date("2026-11-20T09:30:00Z"), ip: "203.0.113.7", userAgent: "Mozilla/5.0", wordsShown: "I approve this proof. This is what gets made.", checks: PROOF_CHECKS, sheetSha256: sheet });
    expect(evidence.recordSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.signedAt).toBe("2026-11-20T09:30:00.000Z");
    expect(evidenceIsIntact(evidence)).toBe(true);
    expect(evidenceIsIntact({ ...evidence, name: "Someone Else" })).toBe(false);
    expect(evidenceIsIntact({ ...evidence, sheetSha256: sha256Hex("another sheet") })).toBe(false);
    expect(evidenceIsIntact({ ...evidence, wordsShown: "I approve." })).toBe(false);
  });
});

describe("client roles", () => {
  test("Owner does everything, Viewer only looks, Buyer accepts within the limit and never signs a proof", () => {
    expect(clientMay("owner", "sign_proof")).toBe(true);
    expect(clientMay("viewer", "view")).toBe(true);
    expect(clientMay("viewer", "request_quote")).toBe(false);
    expect(clientMay("buyer", "change_quote")).toBe(true);
    expect(clientMay("buyer", "accept_quote", { amountCents: 1_000_000, spendLimitCents: 1_000_000 })).toBe(true);
    expect(clientMay("buyer", "accept_quote", { amountCents: 1_000_001, spendLimitCents: 1_000_000 })).toBe(false);
    expect(clientMay("buyer", "accept_quote", { amountCents: 500 })).toBe(false);
    expect(clientMay("buyer", "sign_proof")).toBe(false);
    expect(clientMay("buyer", "manage_team")).toBe(false);
  });
});
