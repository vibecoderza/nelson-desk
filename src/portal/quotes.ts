// What the Portal's quote screens show. Every view is one client's own quotes, sent versions only, and passes the
// exposure walk before it is returned. A draft is Nelson's until it is sent.
import { assertPortalSafe } from "../exposure/private.ts";
import { PORTAL_WORDS, waitingOn, type LineState } from "../domain/line.ts";
import { clientCan, DECLINE_REASONS, type DeclineReason, type QuoteState } from "../domain/quote.ts";
import type { PriceTotals } from "../nelson/client.ts";
import { latestVersion, versionOf, type BookLine, type BookMessage, type BookQuote, type QuoteBook } from "../quotes/book.ts";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import { chosenBreak, DECLINE_WORDS, LINE_TONE, STATE_TONE, STATE_WORDS } from "../quotes/words.ts";
import { day, plural } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";

const visible = (q: BookQuote) => q.state !== "draft" && q.versions.length > 0;

export type PortalTab = "open" | "accepted" | "closed";
const TAB_OF: Record<Exclude<QuoteState, "draft">, PortalTab> = { working: "open", final: "open", accepted: "accepted", declined: "closed", expired: "closed" };

export type PortalRow = {
  ref: string; state_word: string; tone: Tone; title: string; changed: string; version: number; total_cents: number;
  tiles: string[]; // one colour per product, until the customiser publishes mockups
  picture: string | null; // the first mockup on the quote, when there is one
  chip: { tone: Tone; words: string };
  action: { kind: "open" | "decide" | "ask_again" | "reopen" | "order"; label: string };
};
export type PortalQuotes = { client_name: string; tab: PortalTab; counts: Record<PortalTab, number>; rows: PortalRow[] };

function row(q: BookQuote, now: Date): PortalRow {
  const v = latestVersion(q)!;
  const waiting = q.lines.filter((l) => l.state === "waiting_on_nelson").length;
  const suggested = q.lines.filter((l) => l.state === "nelson_suggests").length;
  const openChip = (): PortalRow["chip"] =>
    waiting ? { tone: "warn", words: `${plural(waiting, "change")} waiting on Nelson` }
    : suggested ? { tone: "bad", words: `${plural(suggested, "suggestion")} for you` }
    : { tone: "warn", words: "Nelson is working on it" };
  const mayReopen = q.state === "declined" && q.valid_until !== null && now.getTime() <= q.valid_until.getTime();
  const by: Record<Exclude<QuoteState, "draft">, Pick<PortalRow, "changed" | "chip" | "action">> = {
    working: { changed: `v${v.version} sent ${day(v.sent_at)}`, chip: openChip(), action: { kind: "open", label: "Open" } },
    final: { changed: `Sent ${day(v.sent_at)} · valid to ${day(q.valid_until)}`, chip: { tone: "ok", words: "Ready to accept and pay" }, action: { kind: "decide", label: "Accept and pay" } },
    accepted: { changed: `Paid ${day(q.decided_at)} · became order ${q.order_ref}`, chip: { tone: "plain", words: `Order ${q.order_ref}` }, action: { kind: "order", label: "View order" } },
    declined: { changed: `You declined ${day(q.decided_at)}`, chip: { tone: "plain", words: "Declined" }, action: mayReopen ? { kind: "reopen", label: "Re-open" } : { kind: "open", label: "Open" } },
    expired: { changed: `No answer · closed ${day(q.decided_at)}`, chip: { tone: "plain", words: "Expired" }, action: { kind: "ask_again", label: "Ask again" } },
  };
  const state = q.state as Exclude<QuoteState, "draft">;
  return { ref: q.ref, state_word: STATE_WORDS[state], tone: STATE_TONE[state], title: q.title, version: v.version, total_cents: v.totals.total_cents, tiles: q.lines.slice(0, 3).map((l) => l.colour_hex), picture: q.lines.find((l) => l.picture)?.picture ?? null, ...by[state] };
}

export async function portalQuotes(book: QuoteBook, clientId: string, tab: PortalTab, now: Date): Promise<PortalQuotes | null> {
  const quotes = (await book.forClient(clientId)).filter(visible);
  const name = quotes[0]?.client.name;
  if (!name) return null;
  const tabOf = (q: BookQuote) => TAB_OF[q.state as Exclude<QuoteState, "draft">];
  const counts = { open: 0, accepted: 0, closed: 0 };
  for (const q of quotes) counts[tabOf(q)] += 1;
  const rows = quotes.filter((q) => tabOf(q) === tab).sort((a, b) => (b.last_sent_at?.getTime() ?? 0) - (a.last_sent_at?.getTime() ?? 0)).map((q) => row(q, now));
  return assertPortalSafe({ client_name: name, tab, counts, rows }, "the Portal's quote list");
}

export type PortalLine = {
  id: string; name: string; colour: string; colour_hex: string; picture: string | null; decoration_words: string; quantity: number;
  breaks: { quantity: number; chosen: boolean }[]; unit_cents: number | null; line_total_cents: number | null;
  left_out: boolean; // the client's pick drops this piece
  pickable: boolean; // agreed, with quoted quantities to choose between
  state: LineState; state_word: string; tone: Tone; note: string; suggestion: string | null;
};
export type PortalQuote = {
  client_name: string; ref: string; title: string; state: QuoteState; state_word: string; tone: Tone;
  versions: { version: number; sent: string; shown: boolean }[]; shown: number; is_current: boolean; changes: string[];
  lines: PortalLine[]; totals: PriceTotals; delivery_words: string; valid_until: Date | null; terms: string;
  can: ReturnType<typeof clientCan>; waiting_on: ReturnType<typeof waitingOn>; not_agreed: number;
  messages: BookMessage[]; order_ref: string | null; open_count: number;
  pick: QuotePick; picked: boolean; // what the client is trying out, before they ask for it
};

// A pick is the client trying out quantities before asking for them: line id to quantity, nought to leave a piece
// out. It lives in the address, saves nothing, and only ever lands on a quantity Nelson already quoted, at the
// price Nelson quoted for it. Asking for the pick is a change; Nelson answers with a new version.
export type QuotePick = Record<string, number>;
export function parsePick(text: string | undefined): QuotePick {
  const pick: QuotePick = {};
  for (const part of (text ?? "").slice(0, 600).split(",")) {
    const m = /^(ql_[a-z0-9]{1,12}):(\d{1,5})$/.exec(part);
    if (m) pick[m[1]!] = Number(m[2]);
  }
  return pick;
}
export const pickText = (pick: QuotePick): string => Object.entries(pick).map(([id, n]) => `${id}:${n}`).join(",");
// Keeps only what the quote allows: an agreed line, and nought or one of its quoted quantities.
export function allowedPick(lines: BookLine[], pick: QuotePick): QuotePick {
  const out: QuotePick = {};
  for (const l of lines) {
    const n = pick[l.id];
    if (n === undefined || l.state !== "agreed" || n === l.quantity) continue;
    if (n === 0 || l.ladder.some((b) => b.min_quantity === n)) out[l.id] = n;
  }
  return out;
}
function picked(l: BookLine, n: number | undefined): { quantity: number; unit_cents: number | null; line_total_cents: number | null } {
  if (n === undefined) return { quantity: l.quantity, unit_cents: l.unit_cents, line_total_cents: l.line_total_cents };
  if (n === 0) return { quantity: 0, unit_cents: l.unit_cents, line_total_cents: 0 };
  const quoted = l.ladder.find((b) => b.min_quantity === n)!.unit_cents;
  return { quantity: n, unit_cents: quoted, line_total_cents: quoted * n };
}

// A pick's total is the quoted line prices added up, with set-up and delivery as sent. Nelson confirms it.
function pickTotals(sent: PriceTotals, shown: { line_total_cents: number | null }[]): PriceTotals {
  const lines_cents = shown.reduce((sum, l) => sum + (l.line_total_cents ?? 0), 0);
  return { ...sent, lines_cents, total_cents: lines_cents + sent.setup_cents + sent.delivery_cents };
}

const termsWords = (totalCents: number, validUntil: Date | null) =>
  `Card or EFT · ${totalCents > QUOTE_SETTINGS.depositOverCents ? `${QUOTE_SETTINGS.depositPct}% deposit to start` : "paid in full to start"} · valid to ${day(validUntil)}`;

export async function portalQuote(book: QuoteBook, clientId: string, ref: string, wanted: number | undefined, _now: Date, asked: QuotePick = {}): Promise<PortalQuote | null> {
  const quote = await book.byRef(ref);
  // Someone else's quote and a quote that does not exist look the same from outside.
  if (!quote || quote.client.id !== clientId || !visible(quote)) return null;
  const current = latestVersion(quote)!;
  const v = (wanted && versionOf(quote, wanted)) || current;
  const isCurrent = v.version === current.version;
  // The newest version shows the lines as they stand now, changes in flight included. An older one is frozen.
  const lines = isCurrent ? quote.lines : v.lines;
  const suggestionFor = (l: BookLine) => (isCurrent && l.state === "nelson_suggests" ? quote.amendments.find((a) => a.line_id === l.id && a.state === "suggested")?.suggestion ?? null : null);
  const states = lines.map((l) => l.state);
  const can = isCurrent ? clientCan(quote.state) : clientCan("accepted");
  const pick = can.change ? allowedPick(lines, asked) : {};
  const isPicked = Object.keys(pick).length > 0;
  const shown = lines.map((l) => picked(l, pick[l.id]));
  const open = (await book.forClient(clientId)).filter((q) => q.state === "working" || q.state === "final").length;
  return assertPortalSafe({
    client_name: quote.client.name, ref: quote.ref, title: quote.title, state: quote.state, state_word: STATE_WORDS[quote.state], tone: STATE_TONE[quote.state],
    versions: quote.versions.map((x) => ({ version: x.version, sent: day(x.sent_at), shown: x.version === v.version })), shown: v.version, is_current: isCurrent, changes: v.change_log,
    lines: lines.map((l, i) => {
      const now = shown[i]!;
      const chosen = chosenBreak(l.ladder, now.quantity);
      return {
        id: l.id, name: l.product_name, colour: l.colour, colour_hex: l.colour_hex, picture: l.picture, decoration_words: l.decoration_words, quantity: now.quantity,
        breaks: l.ladder.map((b) => ({ quantity: b.min_quantity, chosen: now.quantity > 0 && b.min_quantity === chosen })), unit_cents: now.unit_cents, line_total_cents: now.line_total_cents,
        left_out: now.quantity === 0, pickable: can.change && l.state === "agreed" && l.ladder.length > 0,
        state: l.state, state_word: l.state === "waiting_on_supplier" ? `${PORTAL_WORDS[l.state]} ${day(l.due_date)}` : PORTAL_WORDS[l.state], tone: LINE_TONE[l.state], note: l.note, suggestion: suggestionFor(l),
      };
    }),
    totals: isPicked ? pickTotals(v.totals, shown) : v.totals, delivery_words: v.delivery_words, valid_until: quote.valid_until, terms: termsWords(v.totals.total_cents, quote.valid_until),
    can, waiting_on: waitingOn(states), not_agreed: states.filter((s) => s !== "agreed").length,
    messages: quote.messages, order_ref: quote.order_ref, open_count: open, pick, picked: isPicked,
  }, `the Portal's quote ${ref}`);
}

export type PortalDecide = {
  client_name: string; ref: string; title: string; version: number; summary: string; total_cents: number; valid_until: Date | null;
  state: QuoteState; can: ReturnType<typeof clientCan>; deposit: boolean; reasons: { value: DeclineReason; words: string }[]; open_count: number;
};

export async function portalDecide(book: QuoteBook, clientId: string, ref: string): Promise<PortalDecide | null> {
  const quote = await book.byRef(ref);
  if (!quote || quote.client.id !== clientId || !visible(quote)) return null;
  const v = latestVersion(quote)!;
  const open = (await book.forClient(clientId)).filter((q) => q.state === "working" || q.state === "final").length;
  return assertPortalSafe({
    client_name: quote.client.name, ref: quote.ref, title: quote.title, version: v.version, summary: quote.summary, total_cents: v.totals.total_cents, valid_until: quote.valid_until,
    state: quote.state, can: clientCan(quote.state), deposit: v.totals.total_cents > QUOTE_SETTINGS.depositOverCents,
    reasons: DECLINE_REASONS.map((value) => ({ value, words: DECLINE_WORDS[value] })), open_count: open,
  }, `the Portal's decision on ${ref}`);
}
