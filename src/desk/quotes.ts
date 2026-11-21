// What the Desk's quote screens show. Desk only: the builder carries Nelson's staff answer (supplier, cost,
// mark-up, margin), which never leaves this folder. The Desk works nothing out: every price cell is Nelson's
// answer, live or frozen with a version.
import { DESK_WORDS, waitingOn, type LineState } from "../domain/line.ts";
import { daysSinceSent, followUps, type QuoteState } from "../domain/quote.ts";
import { deliveryEstimate, NelsonError, type DeliveryEstimate, type NelsonConfig, type PriceRequest, type PriceTotals } from "../nelson/client.ts";
import { latestVersion, type BookAmendment, type BookMessage, type BookQuote, type QuoteBook } from "../quotes/book.ts";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import { DECLINE_WORDS, LINE_TONE, STATE_WORDS } from "../quotes/words.ts";
import { day, isoDay, plural } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";
import { priceForStaff, type StaffLine, type StaffPrice } from "./nelson-staff.ts";

const DAY = 86_400_000;
const isOpen = (s: QuoteState) => s === "draft" || s === "working" || s === "final";

export type PipelineTab = "open" | "accepted" | "declined" | "expired";
export type PipelineGroup = "overdue" | "due" | "working" | "decided";
export type PipelineAction = { kind: "open" | "send_check_in" | "send_video_ask" | "last_ask" | "rework" | "order"; label: string; next: boolean };
export type PipelineRow = {
  ref: string; client: string; what: string; total_cents: number | null; seen: string; order_ref: string | null; group: PipelineGroup; tone: Tone;
  chip: { tone: Tone; words: string }; action: PipelineAction;
};
export type Pipeline = {
  tab: PipelineTab; counts: Record<PipelineTab, number>; overdue: number; groups: { key: PipelineGroup; title: string; hint: string; rows: PipelineRow[] }[]; flat: PipelineRow[];
  month: { win_pct: number | null; won: number; decided: number; hours_to_first_quote: number | null; days_to_decision: number | null };
  lost: { words: string; count: number }[];
};

const dayWord = (n: number) => (n === 1 ? "tomorrow" : `in ${n} days`);
const agoWord = (n: number) => (n === 1 ? "yesterday" : `${n} days ago`);

function seenWords(q: BookQuote, now: Date): string {
  if (!q.last_sent_at) return "Not sent";
  if (q.state === "accepted") return `Paid ${day(q.decided_at)}`;
  if (q.state === "declined") return `Declined ${day(q.decided_at)}`;
  if (q.state === "expired") return `Closed ${day(q.decided_at)}`;
  if (!q.seen.opened_at) return "Not opened";
  const times = q.seen.times_opened === 2 ? "Opened twice" : daysSinceSent(q.seen.opened_at, now) === 0 ? "Opened today" : `Opened ${day(q.seen.opened_at)}`;
  return q.follow_ups_sent.includes("video_ask") || q.seen.times_opened === 2 ? `${times} · video ${q.seen.video_at ? "watched" : "not watched"}` : times;
}

export function pipelineRow(q: BookQuote, now: Date): PipelineRow {
  const v = latestVersion(q);
  const s = QUOTE_SETTINGS.followUps;
  const base = { ref: q.ref, client: q.client.name, what: `${q.title}${v ? ` · v${v.version}` : " · draft"}`, total_cents: v?.totals.total_cents ?? null, seen: seenWords(q, now), order_ref: q.order_ref };
  const open: PipelineAction = { kind: "open", label: "Open", next: false };

  if (q.state === "accepted") return { ...base, group: "decided", tone: "ok", chip: { tone: "ok", words: `Accepted → ${q.order_ref}` }, action: { kind: "order", label: "Order", next: false } };
  if (q.state === "declined") return { ...base, group: "decided", tone: "plain", chip: { tone: "bad", words: q.decline ? DECLINE_WORDS[q.decline.reason] : "Declined" }, action: { kind: "rework", label: "Re-work", next: false } };
  if (q.state === "expired") return { ...base, group: "decided", tone: "plain", chip: { tone: "plain", words: q.expired_cause === "no_reply" ? "No reply" : "Past its valid-to date" }, action: open };
  if (q.state === "draft" || !q.last_sent_at) return { ...base, group: "working", tone: "plain", chip: { tone: "plain", words: q.waiting_words ?? "Draft · not sent" }, action: open };

  // The follow-up clock only runs while the client holds the next move. A change waiting on us is ours to answer.
  const waiting = waitingOn(q.lines.map((l) => l.state));
  if (waiting === "nelson") return { ...base, group: "working", tone: "warn", chip: { tone: "warn", words: "Their change to answer" }, action: open };
  if (waiting === "supplier") return { ...base, group: "working", tone: "warn", chip: { tone: "warn", words: "Costing request out" }, action: open };

  const d = daysSinceSent(q.last_sent_at, now);
  const { followUps: [checkIn, video], closeAsNoReply } = followUps(q.last_sent_at, now, q.follow_ups_sent, s);
  const due = [{ f: checkIn!, on: s.checkInDay, kind: "send_check_in" as const }, { f: video!, on: s.videoDay, kind: "send_video_ask" as const }];
  const late = due.find((x) => x.f.status === "overdue");
  if (late) return { ...base, group: "overdue", tone: "bad", chip: { tone: "bad", words: `Day ${late.on} was due ${agoWord(d - late.on)}` }, action: { kind: late.kind, label: `Send day ${late.on}`, next: true } };
  const today = due.find((x) => x.f.status === "due");
  if (today) return { ...base, group: "due", tone: "warn", chip: { tone: "warn", words: `Day ${today.on} due today` }, action: { kind: today.kind, label: `Send day ${today.on}`, next: false } };
  const upcoming = due.find((x) => x.f.status === "not_yet");
  if (upcoming) return { ...base, group: "working", tone: waiting === "client" ? "warn" : "plain", chip: { tone: "plain", words: `Day ${upcoming.on} due ${dayWord(upcoming.on - d)}` }, action: open };
  // Both follow-ups are out. What is left is the close.
  const left = s.closeDay - d;
  if (closeAsNoReply) return { ...base, group: "overdue", tone: "bad", chip: { tone: "bad", words: `Closes today as “No reply”` }, action: { kind: "last_ask", label: "Last ask", next: false } };
  if (left === 1) return { ...base, group: "overdue", tone: "bad", chip: { tone: "bad", words: `Closes tomorrow, day ${s.closeDay}` }, action: { kind: "last_ask", label: "Last ask", next: false } };
  return { ...base, group: "working", tone: "plain", chip: { tone: "plain", words: `Closes day ${s.closeDay}, ${dayWord(left)}` }, action: open };
}

const GROUPS: { key: PipelineGroup; title: string; hint: string }[] = [
  { key: "overdue", title: "Follow-up overdue", hint: "Due date has passed" },
  { key: "due", title: "Follow-up due today", hint: "" },
  { key: "working", title: "Working", hint: "Waiting on us or on them" },
  { key: "decided", title: "Decided this week", hint: "" },
];
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const oneDecimal = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export async function pipeline(book: QuoteBook, tab: PipelineTab, now: Date): Promise<Pipeline> {
  const quotes = await book.all();
  const tabOf = (q: BookQuote): PipelineTab => (isOpen(q.state) ? "open" : (q.state as PipelineTab));
  const counts = { open: 0, accepted: 0, declined: 0, expired: 0 };
  for (const q of quotes) counts[tabOf(q)] += 1;
  const decidedThisWeek = (q: BookQuote) => !isOpen(q.state) && q.decided_at !== null && now.getTime() - q.decided_at.getTime() <= 7 * DAY;
  const rows = quotes.map((q) => ({ q, row: pipelineRow(q, now) }));
  const openRows = rows.filter(({ q }) => isOpen(q.state) || decidedThisWeek(q)).map((x) => x.row);
  const groups = GROUPS.map((g) => ({ ...g, rows: openRows.filter((r) => r.group === g.key) })).filter((g) => g.rows.length);
  const flat = rows.filter(({ q }) => tabOf(q) === tab).sort((a, b) => (b.q.decided_at?.getTime() ?? 0) - (a.q.decided_at?.getTime() ?? 0)).map((x) => x.row);

  const decided = quotes.filter((q) => !isOpen(q.state));
  const won = decided.filter((q) => q.state === "accepted");
  const lost = new Map<string, number>();
  for (const q of decided) {
    const words = q.state === "declined" && q.decline ? DECLINE_WORDS[q.decline.reason] : q.state === "expired" ? "No reply" : null;
    if (words) lost.set(words, (lost.get(words) ?? 0) + 1);
  }
  return {
    tab, counts, overdue: openRows.filter((r) => r.group === "overdue").length, groups, flat,
    month: {
      win_pct: decided.length ? Math.round((won.length / decided.length) * 100) : null, won: won.length, decided: decided.length,
      hours_to_first_quote: oneDecimal(average(quotes.filter((q) => q.first_sent_at).map((q) => (q.first_sent_at!.getTime() - q.asked_at.getTime()) / 3_600_000))),
      days_to_decision: oneDecimal(average(decided.filter((q) => q.decided_at && q.first_sent_at).map((q) => (q.decided_at!.getTime() - q.first_sent_at!.getTime()) / DAY))),
    },
    lost: [...lost].map(([words, count]) => ({ words, count })).sort((a, b) => b.count - a.count || a.words.localeCompare(b.words)),
  };
}

export const openQuoteCount = async (book: QuoteBook) => (await book.all()).filter((q) => isOpen(q.state)).length;

// ---- The builder ----

export type BuilderLine = {
  id: string; name: string; colour: string; colour_hex: string; picture: string | null; product_code: string; decoration_words: string; quantity: number;
  unit_cents: number | null; line_total_cents: number | null; setup_cents: number | null;
  price: "live" | "frozen" | "none"; // live: Nelson answered just now. frozen: the sent version's figure. none: not priced
  staff: StaffLine | null; state: LineState; state_word: string; tone: Tone;
};
export type Builder = {
  ref: string; client: { id: string; name: string; contact: string; phone_tail: string }; title: string; state: QuoteState; state_word: string; version: number; next_version: number;
  lines: BuilderLine[]; totals: PriceTotals | null; staff_totals: StaffPrice["staff"] | null; price_version: string | null; nelson: { ok: boolean; words: string };
  changes: BookAmendment[]; freight: DeliveryEstimate | null; freight_chosen: string | null; ship_to: string;
  waiting: { tone: Tone; words: string }; can_send: boolean;
  messages: BookMessage[]; versions: { version: number; sent: string }[]; valid_until: Date | null;
};

function priceRequest(q: BookQuote): PriceRequest {
  return {
    quote_ref: q.ref, currency: "ZAR", delivery_address: q.client.address,
    lines: q.lines.map((l) => ({ line_id: l.id, product_code: l.product_code, colour: l.colour.toLowerCase(), quantity: l.quantity, decoration: l.decoration, ...(l.design ? { design: l.design } : {}) })),
  };
}

export async function builder(book: QuoteBook, nelson: NelsonConfig, ref: string, now: Date): Promise<Builder | null> {
  const q = await book.byRef(ref);
  if (!q) return null;
  const sent = latestVersion(q);

  let price: StaffPrice | null = null;
  let freight: DeliveryEstimate | null = null;
  let said = "Prices are Nelson’s live answer.";
  try {
    [price, freight] = await Promise.all([
      priceForStaff(nelson, priceRequest(q)),
      deliveryEstimate(nelson, { lines: q.lines.map((l) => ({ product_code: l.product_code, quantity: l.quantity })), delivery_address: q.client.address, sign_date: isoDay(now) }),
    ]);
  } catch (error) {
    if (!(error instanceof NelsonError) && !(error instanceof TypeError)) throw error;
    said = "Nelson did not answer. Showing the last sent version’s figures.";
  }

  const lines: BuilderLine[] = q.lines.map((l) => {
    const live = price?.lines.find((p) => p.line_id === l.id);
    const priced = live?.status === "priced";
    const frozen = l.unit_cents !== null;
    return {
      id: l.id, name: l.product_name, colour: l.colour, colour_hex: l.colour_hex, picture: l.picture, product_code: l.product_code, decoration_words: l.decoration_words, quantity: l.quantity,
      unit_cents: priced ? live.unit_cents : l.unit_cents, line_total_cents: priced ? live.line_total_cents : l.line_total_cents, setup_cents: priced ? live.setup_cents : l.setup_cents,
      price: priced ? "live" : frozen ? "frozen" : "none", staff: priced ? live.staff : null,
      state: l.state, state_word: DESK_WORDS[l.state], tone: LINE_TONE[l.state],
    };
  });
  const allLive = lines.length > 0 && lines.every((l) => l.price === "live");
  if (price && !allLive) said = lines.some((l) => l.price === "frozen") ? "The stand-in Nelson holds no cost for these lines. Showing the sent version’s prices; cost and margin appear when Nelson answers." : "Nelson cannot price this yet: it needs a human.";

  const states = q.lines.map((l) => l.state);
  const on = waitingOn(states);
  const toAnswer = q.amendments.filter((a) => a.state === "waiting").length;
  const outWithClient = q.amendments.filter((a) => a.state === "suggested").length;
  const waiting: Builder["waiting"] =
    q.state === "draft" ? { tone: "plain", words: q.waiting_words ?? "Not sent yet" }
    : q.state === "accepted" ? { tone: "ok", words: `Paid · order ${q.order_ref}` }
    : q.state === "declined" ? { tone: "bad", words: "Declined" }
    : q.state === "expired" ? { tone: "plain", words: "Expired" }
    : on === "nelson" ? { tone: "warn", words: `You · ${plural(toAnswer, "change")} to answer${outWithClient ? ` · ${outWithClient} with client` : ""}` }
    : on === "supplier" ? { tone: "warn", words: "A costing request" }
    : on === "client" ? { tone: "warn", words: `Client · ${plural(outWithClient, "suggestion")} out` }
    : { tone: "ok", words: "Nobody · ready to accept" };

  return {
    ref: q.ref, client: { id: q.client.id, name: q.client.name, contact: q.client.contact_name, phone_tail: q.client.phone_tail }, title: q.title, state: q.state, state_word: STATE_WORDS[q.state],
    version: q.version, next_version: q.version + 1, lines,
    totals: allLive ? price!.totals : sent?.totals ?? null, staff_totals: allLive ? price!.staff : null, price_version: price?.price_version ?? sent?.price_version ?? null,
    nelson: { ok: allLive, words: said },
    changes: q.amendments.filter((a) => a.state === "waiting" || a.state === "suggested"), freight, freight_chosen: freight ? (price?.delivery?.service ?? freight.freight_options[0]?.service ?? null) : null,
    ship_to: `${q.client.address.city} ${q.client.address.postal_code}`,
    waiting, can_send: q.lines.length > 0 && q.state !== "accepted" && q.state !== "declined",
    messages: q.messages, versions: q.versions.map((v) => ({ version: v.version, sent: day(v.sent_at) })), valid_until: q.valid_until,
  };
}
