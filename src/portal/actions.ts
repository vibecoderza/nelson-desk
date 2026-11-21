"use server";
// What a client can do to a quote. Each action asks the state machine first and says what it answered. On mock
// data that is where it stops: the write, the event and the outbox rows land with the database.
import { redirect } from "next/navigation";
import { amendmentTransition } from "../domain/amendment.ts";
import { allAgreed } from "../domain/line.ts";
import { clientCan, DECLINE_REASONS, quoteTransition, type DeclineReason, type QuoteContext } from "../domain/quote.ts";
import { latestVersion, type BookQuote } from "../quotes/book.ts";
import { NOTHING_SAVED, quoteBook, saidUrl, type Said } from "../quotes/source.ts";
import { rand } from "../ui/format.ts";
import { portalClientId } from "./who.ts";

const REF = /^Q-\d{5}$/;
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function ownQuote(form: FormData): Promise<BookQuote | null> {
  const ref = text(form, "ref");
  if (!REF.test(ref)) return null;
  const quote = await quoteBook().byRef(ref);
  return quote && quote.client.id === portalClientId() && quote.state !== "draft" ? quote : null;
}
const ctxOf = (q: BookQuote): QuoteContext => ({ allLinesAgreed: allAgreed(q.lines.map((l) => l.state)), lineCount: q.lines.length, now: new Date(), validUntil: q.valid_until });
const back = (q: BookQuote | null, page: "" | "/decide", said: Said): never => redirect(saidUrl(q ? `/quotes/${q.ref}${page}` : "/quotes", said));
const refused = (reason: string): Said => ({ ok: false, text: reason.charAt(0).toUpperCase() + reason.slice(1) + "." });

export async function acceptQuote(form: FormData): Promise<void> {
  const q = await ownQuote(form);
  if (!q) return back(null, "", refused("that quote is not here"));
  if (!clientCan(q.state).acceptAndPay || !ctxOf(q).allLinesAgreed) return back(q, "/decide", refused("accept and pay unlocks only when every line reads Agreed"));
  const method = text(form, "method") === "eft" ? "EFT" : "card";
  const total = rand(latestVersion(q)!.totals.total_cents);
  return back(q, "/decide", { ok: true, text: `${method === "card" ? `The card page would open for ${total}` : `You would get our bank details, with ${q.ref} as the reference, for ${total}`}. ${NOTHING_SAVED}` });
}

export async function declineQuote(form: FormData): Promise<void> {
  const q = await ownQuote(form);
  if (!q) return back(null, "", refused("that quote is not here"));
  const reason = text(form, "reason") as DeclineReason;
  if (!DECLINE_REASONS.includes(reason)) return back(q, "/decide", refused("pick a reason first, it takes ten seconds"));
  const rands = Number(text(form, "budget").replace(/[^\d]/g, ""));
  const budgetCents = Number.isSafeInteger(rands) && rands > 0 ? rands * 100 : undefined;
  const next = quoteTransition({ state: q.state, version: q.version }, { type: "decline", reason, budgetCents, note: text(form, "note") || undefined }, "client", ctxOf(q));
  if (!next.ok) return back(q, "/decide", refused(next.code === "budget_required" ? "tell us the number you need to hit, so we can try to re-work it" : next.reason));
  const rework = text(form, "intent") === "rework" && reason === "too_expensive";
  return back(q, "/decide", { ok: true, text: `${rework ? `Nelson would get a re-work request at ${rand(budgetCents)}` : `${q.ref} would close as declined`}. ${NOTHING_SAVED}` });
}

export async function takeSuggestion(form: FormData): Promise<void> {
  const q = await ownQuote(form);
  if (!q) return back(null, "", refused("that quote is not here"));
  const amendment = q.amendments.find((a) => a.line_id === text(form, "line") && a.state === "suggested");
  const next = amendment ? amendmentTransition(amendment.state, { type: "take_suggestion" }, "client") : null;
  if (!amendment || !next?.ok) return back(q, "", refused("there is no suggestion waiting on that line"));
  return back(q, "", { ok: true, text: `The line would take Nelson's ${amendment.suggestion} and read Agreed, and the quote would move to v${q.version + 1}. ${NOTHING_SAVED}` });
}

export async function reopenQuote(form: FormData): Promise<void> {
  const q = await ownQuote(form);
  if (!q) return back(null, "", refused("that quote is not here"));
  if (q.state === "expired") return redirect(saidUrl("/quotes", clientCan(q.state).ask ? { ok: true, text: `Nelson would be asked to quote ${q.title} again, as a new version. ${NOTHING_SAVED}` } : refused("that quote cannot be asked again")));
  const next = quoteTransition({ state: q.state, version: q.version }, { type: "reopen" }, "client", ctxOf(q));
  return redirect(saidUrl("/quotes", next.ok ? { ok: true, text: `${q.ref} would re-open as Working. ${NOTHING_SAVED}` } : refused(next.reason)));
}

export async function askOnQuote(form: FormData): Promise<void> {
  const q = await ownQuote(form);
  if (!q) return back(null, "", refused("that quote is not here"));
  if (!text(form, "message")) return back(q, "", refused("write the message first"));
  return back(q, "", { ok: true, text: `Your message would go to Nelson on ${q.ref}. ${NOTHING_SAVED}` });
}
