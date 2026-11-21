// The quote book: what a quote screen reads. Customer view only, the same on both surfaces. Nothing in here names a
// supplier, a cost or a margin: on the Desk those come from Nelson's staff answer and stay in src/desk.
// The shapes follow prisma/schema.prisma (quote, quote_version, quote_line, amendment, decline, message), so the
// database reader that replaces the stand-in book returns the same thing.
import type { AmendmentState } from "../domain/amendment.ts";
import type { LineState } from "../domain/line.ts";
import type { DeclineReason, FollowUpKind, QuoteState } from "../domain/quote.ts";
import type { Address, Decoration, PriceTotals } from "../nelson/client.ts";

export type Break = { min_quantity: number; unit_cents: number };

export type BookLine = {
  id: string;
  position: number;
  product_code: string; // ours, never a supplier's
  product_name: string;
  colour: string;
  colour_hex: string;
  picture: string | null; // the mockup, as an image source. Null until the customiser publishes one
  quantity: number;
  decoration: Decoration[];
  decoration_words: string; // "Front embroidery · 2 threads · 60 × 25 mm"
  design: { ref: string; rev: number } | null;
  state: LineState;
  note: string; // one plain sentence the client reads beside the state
  due_date: Date | null;
  unit_cents: number | null; // Nelson's answer, frozen with the version
  setup_cents: number | null;
  line_total_cents: number | null;
  ladder: Break[];
};

export type BookVersion = {
  version: number;
  sent_at: Date;
  price_version: string;
  totals: PriceTotals;
  delivery_words: string; // "Economy · Cape Town"
  lines: BookLine[]; // as the client saw them
  change_log: string[]; // against the version before
};

export type BookAmendment = {
  id: string;
  line_id: string;
  state: AmendmentState;
  kind: "design" | "quantity" | "colour" | "words";
  summary: string; // "Cap logo 80 → 60 mm"
  asked_by: string;
  asked_at: Date;
  check: { passes: boolean; words: string }; // from Nelson's design-check
  suggestion: string | null;
  answered_at: Date | null;
};

export type BookMessage = { author: "client" | "nelson"; name: string; at: Date; channel: "whatsapp" | "portal" | "email"; tag: string | null; text: string };

export type BookClient = { id: string; name: string; contact_name: string; contact_email: string; phone_tail: string; address_words: string; address: Address };

export type BookQuote = {
  ref: string;
  client: BookClient;
  title: string;
  summary: string; // "100 caps and 50 tumblers, delivered"
  state: QuoteState;
  version: number; // 0 until first sent
  asked_at: Date;
  first_sent_at: Date | null;
  last_sent_at: Date | null;
  valid_until: Date | null;
  seen: { opened_at: Date | null; times_opened: number; video_at: Date | null };
  follow_ups_sent: FollowUpKind[];
  versions: BookVersion[];
  lines: BookLine[]; // the working lines, with their live states
  amendments: BookAmendment[];
  messages: BookMessage[];
  decided_at: Date | null;
  decline: { reason: DeclineReason; budget_cents: number | null; note: string | null } | null;
  expired_cause: "no_reply" | "validity" | null;
  order_ref: string | null;
  waiting_words: string | null; // a draft's own reason it has not gone out, e.g. "Waiting on artwork"
};

export type QuoteBook = {
  all(): Promise<BookQuote[]>;
  forClient(clientId: string): Promise<BookQuote[]>;
  byRef(ref: string): Promise<BookQuote | null>;
};

export const latestVersion = (q: BookQuote): BookVersion | null => q.versions.at(-1) ?? null;
export const versionOf = (q: BookQuote, n: number): BookVersion | null => q.versions.find((v) => v.version === n) ?? null;
