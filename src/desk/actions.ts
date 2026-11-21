"use server";
// What staff can do to a quote. Each action asks the state machines first and says what they answered. On mock
// data that is where it stops: the write, the event and the outbox rows land with the database.
import { redirect } from "next/navigation";
import { amendmentTransition, type AmendmentEvent } from "../domain/amendment.ts";
import { allAgreed, lineTransition } from "../domain/line.ts";
import { followUps, quoteTransition, type FollowUpKind } from "../domain/quote.ts";
import type { BookQuote } from "../quotes/book.ts";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import { NOTHING_SAVED, quoteBook, saidUrl, type Said } from "../quotes/source.ts";

const REF = /^Q-\d{5}$/;
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refused = (reason: string): Said => ({ ok: false, text: reason.charAt(0).toUpperCase() + reason.slice(1) + "." });
const done = (words: string): Said => ({ ok: true, text: `${words}. ${NOTHING_SAVED}` });

async function quoteOf(form: FormData): Promise<BookQuote | null> {
  const ref = text(form, "ref");
  return REF.test(ref) ? quoteBook().byRef(ref) : null;
}
const page = (form: FormData, q: BookQuote | null) => (q && text(form, "from") !== "pipeline" ? `/quotes/${q.ref}` : "/quotes");

export async function answerChange(form: FormData): Promise<void> {
  const q = await quoteOf(form);
  const amendment = q?.amendments.find((a) => a.id === text(form, "amendment"));
  if (!q || !amendment) return redirect(saidUrl(page(form, q), refused("that change is not on this quote")));
  const intent = text(form, "intent");
  const event: AmendmentEvent = intent === "accept" ? { type: "accept" } : intent === "suggest" ? { type: "suggest", suggestion: text(form, "words") } : { type: "decline", reason: text(form, "words") };
  const next = amendmentTransition(amendment.state, event, "staff");
  if (!next.ok) return redirect(saidUrl(page(form, q), refused(next.code === "missing_suggestion" || next.code === "missing_reason" ? "say what Nelson can make instead, or why not, in the box first" : next.reason)));
  const line = q.lines.find((l) => l.id === amendment.line_id)!;
  const moved = next.value.lineEvent ? lineTransition(line.state, next.value.lineEvent, "staff") : null;
  if (moved && !moved.ok) return redirect(saidUrl(page(form, q), refused(moved.reason)));
  const outcome = intent === "accept" ? `${amendment.summary} would be accepted, the line re-priced by Nelson` : intent === "suggest" ? `The client would see “Nelson suggests ${text(form, "words")}”` : `${amendment.summary} would be declined and the line keep its agreed design`;
  return redirect(saidUrl(page(form, q), done(`${outcome}, and the quote would move to v${q.version + 1}`)));
}

export async function sendVersion(form: FormData): Promise<void> {
  const q = await quoteOf(form);
  if (!q) return redirect(saidUrl("/quotes", refused("that quote is not here")));
  // A version freezes Nelson's prices. A line Nelson has not priced has nothing to freeze.
  if (q.lines.some((l) => l.unit_cents === null)) return redirect(saidUrl(page(form, q), refused("a line has no price from Nelson yet, so there is nothing to send")));
  const ctx = { allLinesAgreed: allAgreed(q.lines.map((l) => l.state)), lineCount: q.lines.length, now: new Date(), validUntil: q.valid_until };
  const next = quoteTransition({ state: q.state, version: q.version }, { type: q.state === "draft" ? "send" : "round_answered" }, "staff", ctx);
  if (!next.ok) return redirect(saidUrl(page(form, q), refused(next.reason)));
  return redirect(saidUrl(page(form, q), done(`v${next.value.version} would be frozen and sent, and the quote would read ${next.value.state === "final" ? "Final" : "Working"}`)));
}

export async function sendFollowUp(form: FormData): Promise<void> {
  const q = await quoteOf(form);
  if (!q || !q.last_sent_at) return redirect(saidUrl("/quotes", refused("that quote has not been sent")));
  const kind = text(form, "kind");
  if (kind === "last_ask") return redirect(saidUrl("/quotes", done(`${q.client.contact_name} would get the last ask before ${q.ref} closes as “No reply”`)));
  const status = followUps(q.last_sent_at, new Date(), q.follow_ups_sent, QUOTE_SETTINGS.followUps).followUps.find((f) => f.kind === (kind as FollowUpKind));
  if (!status || status.status === "sent" || status.status === "not_yet") return redirect(saidUrl("/quotes", refused(status?.status === "sent" ? "that follow-up has already gone" : "that follow-up is not due yet")));
  return redirect(saidUrl("/quotes", done(`${q.client.contact_name} would get the ${kind === "check_in" ? "day-3 check-in" : "day-7 video ask"} on ${q.ref}`)));
}

export async function replyToClient(form: FormData): Promise<void> {
  const q = await quoteOf(form);
  if (!q) return redirect(saidUrl("/quotes", refused("that quote is not here")));
  if (!text(form, "message")) return redirect(saidUrl(page(form, q), refused("write the reply first")));
  return redirect(saidUrl(page(form, q), done(`Your reply would be queued for ${q.client.contact_name}`)));
}

export async function reworkQuote(form: FormData): Promise<void> {
  const q = await quoteOf(form);
  if (!q) return redirect(saidUrl("/quotes", refused("that quote is not here")));
  const ctx = { allLinesAgreed: allAgreed(q.lines.map((l) => l.state)), lineCount: q.lines.length, now: new Date(), validUntil: q.valid_until };
  const next = quoteTransition({ state: q.state, version: q.version }, { type: "reopen" }, "staff", ctx);
  return redirect(saidUrl("/quotes", next.ok ? done(`${q.ref} would re-open as Working for a re-work`) : refused(next.reason)));
}
