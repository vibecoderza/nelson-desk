// The stand-in quote book: eleven quotes that cover every state, group and chip the six quote screens draw.
// It stands where the database will. Every date is counted back from "now", so the follow-up clock keeps telling
// the same story on any day. Q-00007's prices are the contract's price fixture itself; the other amounts are
// frozen answers of the same kind. All figures are illustrative.
import price from "../../contract/fixtures/price-response.customer.json";
import request from "../../contract/fixtures/price-request.json";
import type { LineState } from "../domain/line.ts";
import type { Address, Decoration, PriceTotals } from "../nelson/client.ts";
import type { BookClient, BookLine, BookQuote, BookVersion, QuoteBook } from "../quotes/book.ts";

const DAY = 86_400_000;
const PRICE_VERSION = price.price_version;

const addr = (line1: string, city: string, province: string, postal_code: string): Address => ({ line1, city, province, postal_code, country: "ZA" });
const client = (id: string, name: string, contact_name: string, contact_email: string, phone_tail: string, address: Address): BookClient =>
  ({ id, name, contact_name, contact_email, phone_tail, address, address_words: `${address.line1}, ${address.city} ${address.postal_code}` });

const CLIENTS = {
  moon: client("c_mothermoon", "Mother Moon Herbals", "Holly Daniels", "holly@mothermoon.example", "4410", request.delivery_address as Address),
  brewing: client("c_capepoint", "Cape Point Brewing", "Sipho Ndlovu", "sipho@capepoint.example", "2207", addr("3 Lighthouse Road", "Cape Town", "Western Cape", "7975")),
  lagom: client("c_lagom", "Lagom Studio", "Astrid Berg", "astrid@lagom.example", "9031", addr("88 Bree Street", "Cape Town", "Western Cape", "8001")),
  fynbos: client("c_fynbos", "Fynbos Coffee Co", "Thandi Mokoena", "thandi@fynboscoffee.example", "5518", addr("12 Dorp Street", "Stellenbosch", "Western Cape", "7600")),
  haras: client("c_haras", "Haras Stud Farm", "Pieter van Wyk", "pieter@haras.example", "7742", addr("R44", "Stellenbosch", "Western Cape", "7600")),
  karoo: client("c_karoo", "Karoo Gin Co", "Lerato Khumalo", "lerato@karoogin.example", "1196", addr("5 Voortrekker Street", "Prince Albert", "Western Cape", "6930")),
  dental: client("c_sandton", "Sandton Dental", "Dr Priya Naidoo", "priya@sandtondental.example", "6604", addr("21 Rivonia Road", "Johannesburg", "Gauteng", "2196")),
};
export const MOCK_PORTAL_CLIENT_ID = CLIENTS.moon.id;

type LineIn = Omit<BookLine, "position" | "design" | "due_date" | "ladder" | "decoration" | "state" | "note"> & Partial<Pick<BookLine, "design" | "due_date" | "ladder" | "decoration" | "state" | "note">>;
const line = (position: number, l: LineIn): BookLine => ({ position, design: null, due_date: null, ladder: [], decoration: [], state: "agreed", note: "Priced and agreed.", ...l });
const totals = (lines_cents: number, setup_cents: number, delivery_cents: number, total_cents: number): PriceTotals => ({ lines_cents, setup_cents, delivery_cents, total_cents });

export function mockQuotes(now: Date): BookQuote[] {
  const ago = (days: number, hour = 9) => new Date(Math.floor(now.getTime() / DAY) * DAY - days * DAY + (hour - 2) * 3_600_000);
  const ahead = (days: number) => new Date(Math.floor(now.getTime() / DAY) * DAY + days * DAY + 21 * 3_600_000 + 59 * 60_000);
  const base = { seen: { opened_at: null, times_opened: 0, video_at: null }, follow_ups_sent: [], amendments: [], messages: [], decided_at: null, decline: null, expired_cause: null, order_ref: null, waiting_words: null } satisfies Partial<BookQuote>;

  // One line, one version: enough for a row on a list and a quote that opens.
  const simple = (q: { ref: string; client: BookClient; title: string; summary: string; line: LineIn; delivery_cents: number; delivery_words: string; total_cents: number; version: number; sentDaysAgo: number; askedDaysAgo: number; over?: Partial<BookQuote> }): BookQuote => {
    const l = line(1, q.line);
    const sent = ago(q.sentDaysAgo);
    const versions: BookVersion[] = Array.from({ length: q.version }, (_, i) => ({
      version: i + 1, sent_at: i + 1 === q.version ? sent : ago(q.sentDaysAgo + (q.version - i - 1) * 3), price_version: PRICE_VERSION,
      totals: totals(l.line_total_cents!, l.setup_cents!, q.delivery_cents, q.total_cents), delivery_words: q.delivery_words, lines: [l],
      change_log: i === 0 ? ["First quote"] : ["Quantity confirmed and re-priced"],
    }));
    return { ...base, ref: q.ref, client: q.client, title: q.title, summary: q.summary, state: "final", version: q.version, asked_at: ago(q.askedDaysAgo, 8), first_sent_at: versions[0]!.sent_at, last_sent_at: sent, valid_until: ahead(14 - q.sentDaysAgo), versions, lines: [l], ...q.over };
  };

  // Q-00007. The live one: Nelson's price fixture, two lines, one change to answer and one suggestion out.
  const [capPrice, tumPrice] = price.lines as [typeof price.lines[0], typeof price.lines[0]];
  const [capAsk, tumAsk] = request.lines as [typeof request.lines[0], typeof request.lines[0]];
  const cap = (over: Partial<BookLine> = {}): BookLine => line(1, {
    id: capPrice.line_id, product_code: capAsk.product_code, product_name: "6 Panel Cap", colour: "Forest", colour_hex: "#2f5d46", quantity: capPrice.quantity,
    decoration: capAsk.decoration as Decoration[], decoration_words: "Front embroidery · 2 threads · 80 × 33 mm", design: { ref: capAsk.design.ref, rev: 2 },
    unit_cents: capPrice.unit_cents, setup_cents: capPrice.setup_cents, line_total_cents: capPrice.line_total_cents, ladder: capPrice.ladder, ...over,
  });
  const tumbler = (over: Partial<BookLine> = {}): BookLine => line(2, {
    id: tumPrice.line_id, product_code: tumAsk.product_code, product_name: "Copper Tumbler 500 ml", colour: "Copper", colour_hex: "#b0653a", quantity: tumPrice.quantity,
    decoration: tumAsk.decoration as Decoration[], decoration_words: "Laser engrave · wrap · 40 × 15 mm", design: { ref: tumAsk.design.ref, rev: 1 },
    unit_cents: tumPrice.unit_cents, setup_cents: tumPrice.setup_cents, line_total_cents: tumPrice.line_total_cents, ladder: tumPrice.ladder, ...over,
  });
  const v3: BookVersion = {
    version: 3, sent_at: ago(3, 14), price_version: PRICE_VERSION, totals: price.totals, delivery_words: "Economy · Cape Town",
    lines: [cap({ note: "Forest added in v3 at the same price." }), tumbler({ note: "Unchanged since v2." })],
    change_log: ["Forest added to the 6 Panel Cap (you asked, we sourced it)", "Caps 50 → 100"],
  };
  const v2: BookVersion = {
    version: 2, sent_at: ago(7, 11), price_version: PRICE_VERSION, totals: totals(1_250_000, 60_000, 18_500, 1_328_500), delivery_words: "Economy · Cape Town",
    lines: [cap({ colour: "Black", colour_hex: "#1c1c1c", quantity: 50, unit_cents: 10_500, line_total_cents: 525_000, note: "Priced." }), tumbler({ note: "Added in v2." })],
    change_log: ["Copper Tumbler added, 50"],
  };
  const v1: BookVersion = {
    version: 1, sent_at: ago(11, 10), price_version: PRICE_VERSION, totals: totals(525_000, 35_000, 18_500, 578_500), delivery_words: "Economy · Cape Town",
    lines: [cap({ colour: "Black", colour_hex: "#1c1c1c", quantity: 50, unit_cents: 10_500, line_total_cents: 525_000, note: "Priced." })],
    change_log: ["First quote"],
  };
  const yearEnd: BookQuote = {
    ...base, ref: "Q-00007", client: CLIENTS.moon, title: "Year-end range", summary: "100 caps and 50 tumblers, delivered", state: "working", version: 3,
    asked_at: ago(11, 8), first_sent_at: v1.sent_at, last_sent_at: v3.sent_at, valid_until: new Date(price.valid_until),
    seen: { opened_at: ago(0, 8), times_opened: 4, video_at: null }, versions: [v1, v2, v3],
    lines: [
      cap({ state: "waiting_on_nelson", design: { ref: capAsk.design.ref, rev: capAsk.design.rev }, decoration_words: "Front embroidery · 2 threads · was 80 mm, now 60 mm wide", note: "You made the logo smaller. We check it stitches clean, then confirm the price." }),
      tumbler({ state: "nelson_suggests", note: "Your 12 mm logo is under the 15 mm minimum for engraving. We can do 15 mm." }),
    ],
    amendments: [
      { id: "am_cap01", line_id: capPrice.line_id, state: "waiting", kind: "design", summary: "Cap logo 80 → 60 mm", asked_by: "Holly", asked_at: ago(1, 9), check: { passes: true, words: "Passes: above the 25 mm minimum, 4 100 stitches." }, suggestion: null, answered_at: null },
      { id: "am_tum01", line_id: tumPrice.line_id, state: "suggested", kind: "design", summary: "Tumbler logo 12 mm", asked_by: "Holly", asked_at: ago(4, 15), check: { passes: false, words: "Under the 15 mm laser minimum." }, suggestion: "15 mm", answered_at: ago(3, 14) },
    ],
    messages: [
      { author: "client", name: "Holly", at: ago(6, 10), channel: "whatsapp", tag: null, text: "Can we get the cap in a forest green?" },
      { author: "nelson", name: "Alan", at: ago(3, 14), channel: "whatsapp", tag: "v3", text: "Sourced. Forest is in at the same price, and the caps moved to 100. v3 is in your portal." },
      { author: "client", name: "Holly", at: ago(1, 9), channel: "portal", tag: "Design change", text: "Made the cap logo smaller in the customiser: 80 → 60 mm. Hope that's ok." },
    ],
  };

  const aprons = simple({
    ref: "Q-00012", client: CLIENTS.moon, title: "Staff aprons × 30", summary: "30 aprons, embroidered, delivered", version: 2, sentDaysAgo: 2, askedDaysAgo: 6,
    line: { id: "ql_apr01", product_code: "NEL-APR-CAN", product_name: "Canvas Apron", colour: "Charcoal", colour_hex: "#3b3f42", quantity: 30, decoration_words: "Chest embroidery · 1 thread · 70 × 30 mm", unit_cents: 19_500, setup_cents: 45_000, line_total_cents: 585_000, ladder: [{ min_quantity: 30, unit_cents: 19_500 }, { min_quantity: 50, unit_cents: 18_200 }] },
    delivery_cents: 0, delivery_words: "Included · Cape Town", total_cents: 630_000, over: { seen: { opened_at: ago(2, 16), times_opened: 1, video_at: null } },
  });
  const shopper = simple({
    ref: "Q-00005", client: CLIENTS.moon, title: "Everyday Shopper × 120", summary: "120 shoppers, screen printed, delivered", version: 2, sentDaysAgo: 12, askedDaysAgo: 16,
    line: { id: "ql_bag05", product_code: "NEL-BAG-SHP", product_name: "Everyday Shopper", colour: "Natural", colour_hex: "#e6dcc6", quantity: 120, decoration_words: "Screen print · 1 colour · 200 × 200 mm", unit_cents: 7_000, setup_cents: 45_000, line_total_cents: 840_000 },
    delivery_cents: 15_000, delivery_words: "Economy · Cape Town", total_cents: 900_000, over: { state: "accepted", decided_at: ago(2, 12), order_ref: "N-1035", seen: { opened_at: ago(11), times_opened: 3, video_at: null } },
  });
  const mugs = simple({
    ref: "Q-00002", client: CLIENTS.moon, title: "Bamboo-Lid Mug × 50", summary: "50 mugs, pad printed, delivered", version: 1, sentDaysAgo: 56, askedDaysAgo: 58,
    line: { id: "ql_mug02", product_code: "NEL-MUG-BAM", product_name: "Bamboo-Lid Mug", colour: "White", colour_hex: "#f4f2ee", quantity: 50, decoration_words: "Pad print · 1 colour · 45 × 30 mm", unit_cents: 13_800, setup_cents: 45_000, line_total_cents: 690_000 },
    delivery_cents: 15_000, delivery_words: "Economy · Cape Town", total_cents: 750_000, over: { state: "accepted", decided_at: ago(52, 10), order_ref: "N-1019" },
  });
  const hoodies = simple({
    ref: "Q-00001", client: CLIENTS.moon, title: "Staff hoodies × 40", summary: "40 hoodies, embroidered, delivered", version: 1, sentDaysAgo: 78, askedDaysAgo: 80,
    line: { id: "ql_hood1", product_code: "NEL-HOO-STD", product_name: "Staff Hoodie", colour: "Navy", colour_hex: "#1f2a44", quantity: 40, decoration_words: "Chest embroidery · 2 threads · 80 × 30 mm", unit_cents: 36_000, setup_cents: 55_000, line_total_cents: 1_440_000 },
    delivery_cents: 25_000, delivery_words: "Economy · Cape Town", total_cents: 1_520_000, over: { state: "expired", decided_at: ago(68, 22), expired_cause: "no_reply", follow_ups_sent: ["check_in", "video_ask"] },
  });
  const openers = simple({
    ref: "Q-00003", client: CLIENTS.brewing, title: "Bottle openers × 200", summary: "200 bottle openers, laser engraved, delivered", version: 1, sentDaysAgo: 8, askedDaysAgo: 9,
    line: { id: "ql_opn03", product_code: "NEL-OPN-STL", product_name: "Steel Bottle Opener", colour: "Brushed steel", colour_hex: "#b9bcc0", quantity: 200, decoration_words: "Laser engrave · 30 × 12 mm", unit_cents: 7_250, setup_cents: 45_000, line_total_cents: 1_450_000 },
    delivery_cents: 25_000, delivery_words: "Economy · Cape Town", total_cents: 1_520_000, over: { follow_ups_sent: ["check_in"], seen: { opened_at: ago(5), times_opened: 2, video_at: null } },
  });
  const lagomCaps = simple({
    ref: "Q-00009", client: CLIENTS.lagom, title: "Caps × 30", summary: "30 caps, embroidered, delivered", version: 1, sentDaysAgo: 9, askedDaysAgo: 10,
    line: { id: "ql_cap09", product_code: "NEL-CAP-6P", product_name: "6 Panel Cap", colour: "Stone", colour_hex: "#cfc6b4", quantity: 30, decoration_words: "Front embroidery · 1 thread · 60 × 25 mm", unit_cents: 16_500, setup_cents: 35_000, line_total_cents: 495_000 },
    delivery_cents: 110_000, delivery_words: "Express · Cape Town", total_cents: 640_000, over: { follow_ups_sent: ["check_in", "video_ask"] },
  });
  const fynbos = simple({
    ref: "Q-00004", client: CLIENTS.fynbos, title: "Aprons × 30", summary: "30 aprons, embroidered, delivered", version: 2, sentDaysAgo: 3, askedDaysAgo: 8,
    line: { id: "ql_apr04", product_code: "NEL-APR-CAN", product_name: "Canvas Apron", colour: "Olive", colour_hex: "#6b6f45", quantity: 30, decoration_words: "Chest embroidery · 2 threads · 70 × 30 mm", unit_cents: 23_500, setup_cents: 55_000, line_total_cents: 705_000 },
    delivery_cents: 20_000, delivery_words: "Economy · Stellenbosch", total_cents: 780_000, over: { seen: { opened_at: ago(3, 16), times_opened: 1, video_at: null } },
  });
  const folders = simple({
    ref: "Q-00011", client: CLIENTS.haras, title: "Zip Folder A4 × 250", summary: "250 zip folders, debossed, delivered", version: 2, sentDaysAgo: 1, askedDaysAgo: 5,
    line: { id: "ql_fol11", product_code: "NEL-FOL-A4Z", product_name: "Zip Folder A4", colour: "Black", colour_hex: "#1c1c1c", quantity: 250, decoration_words: "Deboss · front · 80 × 30 mm", unit_cents: 3_800, setup_cents: 45_000, line_total_cents: 950_000 },
    delivery_cents: 55_000, delivery_words: "Economy · Stellenbosch · 5 cartons", total_cents: 1_050_000,
  });
  const scrubCaps = simple({
    ref: "Q-00008", client: CLIENTS.dental, title: "Scrub caps × 60", summary: "60 scrub caps, embroidered, delivered", version: 1, sentDaysAgo: 6, askedDaysAgo: 7,
    line: { id: "ql_scr08", product_code: "NEL-SCR-CAP", product_name: "Scrub Cap", colour: "Teal", colour_hex: "#2b7a78", quantity: 60, decoration_words: "Side embroidery · 1 thread · 40 × 20 mm", unit_cents: 7_500, setup_cents: 35_000, line_total_cents: 450_000 },
    delivery_cents: 25_000, delivery_words: "Economy · Johannesburg", total_cents: 510_000,
    over: { state: "declined", decided_at: ago(4, 15), decline: { reason: "too_expensive", budget_cents: 400_000, note: "Love the caps. The practice signed off R 4 000." }, seen: { opened_at: ago(5), times_opened: 2, video_at: null } },
  });
  const gin: BookQuote = {
    ...base, ref: "Q-00013", client: CLIENTS.karoo, title: "Year-end gifts × 40", summary: "40 gift sets", state: "draft", version: 0, asked_at: ago(1, 13), first_sent_at: null, last_sent_at: null, valid_until: null, versions: [],
    lines: [line(1, { id: "ql_gft13", product_code: "NEL-GFT-SET", product_name: "Gift Set", colour: "Kraft", colour_hex: "#b89b72", quantity: 40, decoration_words: "Method to be chosen once the artwork is in", unit_cents: null, setup_cents: null, line_total_cents: null, note: "Not priced yet." })],
    waiting_words: "Waiting on artwork",
  };

  return [yearEnd, aprons, shopper, mugs, hoodies, openers, lagomCaps, fynbos, folders, scrubCaps, gin];
}

export const MOCK_LINE_STATES: readonly LineState[] = ["agreed", "waiting_on_nelson", "nelson_suggests"];

export function mockBook(now: () => Date = () => new Date()): QuoteBook {
  return {
    all: async () => mockQuotes(now()),
    forClient: async (clientId) => mockQuotes(now()).filter((q) => q.client.id === clientId),
    byRef: async (ref) => mockQuotes(now()).find((q) => q.ref === ref) ?? null,
  };
}
