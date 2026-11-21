// Phase 1, the quote screens on mock data. The stand-in Nelson answers as the mock server does, the stand-in book
// adds up, the pipeline tells the follow-up story the brief sets, and the builder shows Nelson's numbers untouched.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import { fixture } from "@/contract/load.ts";
import { builder, pipeline } from "@/desk/quotes.ts";
import { board } from "@/desk/orders.ts";
import { mockOrders } from "@/mock/orders.ts";
import { nelsonStaffConfig } from "@/desk/mock-nelson-staff.ts";
import { priceForStaff, type StaffPrice } from "@/desk/nelson-staff.ts";
import { BuilderScreen, DeskDocumentScreen, PipelineScreen, TodayScreen } from "@/desk/screens.tsx";
import { mockBook, mockQuotes, MOCK_PORTAL_CLIENT_ID } from "@/mock/book.ts";
import { databaseConfigured, mockBookInUse, mockNelsonInUse } from "@/mock/mode.ts";
import { deliveryEstimate, NelsonError, priceForCustomer, type CustomerPrice, type PriceRequest } from "@/nelson/client.ts";
import { nelsonConfig } from "@/nelson/config.ts";
import { parsePick, portalDecide, portalQuote, portalQuotes } from "@/portal/quotes.ts";
import { DecideScreen, DocumentScreen, QuoteScreen, QuotesScreen } from "@/portal/screens.tsx";
import { quoteDocument } from "@/quotes/document.ts";
import { rand, day } from "@/ui/format.ts";
import { listen, MOCK_DESK_KEY, MOCK_STAFF_KEY } from "../mock/server.ts";

// A Saturday, early afternoon in SAST.
const NOW = new Date("2026-11-21T11:00:00Z");
const book = mockBook(() => NOW);
const noop = async () => {};
const actions = { followUp: noop, rework: noop, answer: noop, send: noop, reply: noop };
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const refusal = (p: Promise<unknown>) => p.then(() => "no refusal", (e: unknown) => (e instanceof NelsonError ? `${e.status} ${e.code}` : String(e)));

// SHOTS_DIR=… writes each screen as a page, for a look at the real thing without a sign-in.
const shots = process.env.SHOTS_DIR;
const keep = (name: string, markup: string) => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  writeFileSync(path.join(shots, `${name}.html`), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="ui.css"><body>${markup}`);
};

describe("the stand-in Nelson inside the app", () => {
  let server: Server, url: string;
  beforeAll(async () => ({ server, url } = await listen()));
  afterAll(() => server.close());
  const request = () => fixture<PriceRequest>("price-request.json");
  const stranger = (): PriceRequest => ({ ...request(), lines: [{ ...request().lines[0]!, line_id: "ql_bag01", quantity: 500 }] });

  test("answers the customer price, the staff price and the delivery estimate exactly as the mock server does", async () => {
    const real = { desk: { baseUrl: url, apiKey: MOCK_DESK_KEY }, staff: { baseUrl: url, apiKey: MOCK_STAFF_KEY } };
    expect(await priceForCustomer(nelsonConfig({}), request())).toEqual(await priceForCustomer(real.desk, request()));
    expect(await priceForStaff(nelsonStaffConfig({}), request())).toEqual(await priceForStaff(real.staff, request()));
    expect(await priceForCustomer(nelsonConfig({}), stranger())).toEqual(await priceForCustomer(real.desk, stranger()));
    expect(await priceForStaff(nelsonStaffConfig({}), stranger())).toEqual(await priceForStaff(real.staff, stranger()));
    const estimate = fixture<Parameters<typeof deliveryEstimate>[1]>("delivery-estimate-request.json");
    expect(await deliveryEstimate(nelsonConfig({}), estimate)).toEqual(await deliveryEstimate(real.desk, estimate));
  });

  test("refuses as the mock server does: no key, and no staff view on the customer key", async () => {
    const inline = nelsonConfig({});
    expect(await refusal(priceForCustomer({ ...inline, apiKey: "nope" }, request()))).toBe("401 unauthorised");
    expect(await refusal(priceForStaff(inline, request()))).toBe("403 staff_scope_required");
    expect(await refusal(priceForCustomer(inline, { ...request(), lines: [] }))).toBe("400 invalid_request");
  });

  test("the customer half holds no staff answer, whatever key is sent", async () => {
    // nelsonConfig's stand-in was built without the staff fixture, so even the staff key gets no staff view from it.
    expect(await refusal(priceForStaff({ ...nelsonConfig({}), apiKey: MOCK_STAFF_KEY }, request()))).toBe("403 staff_scope_required");
  });

  test("mock mode ends by itself the moment a database or Nelson's address is set", () => {
    expect(mockBookInUse({})).toBe(true);
    expect(mockNelsonInUse({})).toBe(true);
    for (const env of [{ DATABASE_URL: "x" }, { DATABASE_URL_PORTAL: "x" }]) {
      expect(databaseConfigured(env)).toBe(true);
      expect(mockBookInUse(env)).toBe(false);
      expect(mockNelsonInUse(env)).toBe(false);
      // With a database and no Nelson, nothing is made up: the config refuses.
      expect(() => nelsonConfig(env)).toThrow(/NELSON_BASE_URL/);
      expect(() => nelsonStaffConfig(env)).toThrow(/NELSON_BASE_URL/);
    }
    expect(mockNelsonInUse({ NELSON_BASE_URL: "https://nelson.example" })).toBe(false);
    expect(nelsonConfig({ NELSON_BASE_URL: "https://nelson.example", NELSON_API_KEY: "k" }).fetch).toBeUndefined();
  });
});

describe("the stand-in quote book", () => {
  const quotes = mockQuotes(NOW);

  test("every sent version adds up, so the screens can stand on it", () => {
    expect(quotes.length).toBeGreaterThanOrEqual(10);
    for (const q of quotes) for (const v of q.versions) {
      expect(v.lines.reduce((sum, l) => sum + l.line_total_cents!, 0), `${q.ref} v${v.version} lines`).toBe(v.totals.lines_cents);
      for (const l of v.lines) expect(l.quantity * l.unit_cents!, `${q.ref} v${v.version} ${l.id}`).toBe(l.line_total_cents);
      expect(v.totals.lines_cents + v.totals.setup_cents + v.totals.delivery_cents, `${q.ref} v${v.version} total`).toBe(v.totals.total_cents);
    }
  });

  test("Q-00007 v3 is Nelson's price fixture, to the cent", () => {
    const q = quotes.find((x) => x.ref === "Q-00007")!;
    const price = fixture<CustomerPrice>("price-response.customer.json");
    expect(q.versions.at(-1)!.totals).toEqual(price.totals);
    expect(q.lines.map((l) => [l.id, l.unit_cents, l.line_total_cents])).toEqual(price.lines.map((l) => [l.line_id, l.unit_cents, l.line_total_cents]));
  });

  test("it covers every quote state the screens draw", () => {
    expect(new Set(quotes.map((q) => q.state))).toEqual(new Set(["draft", "working", "final", "accepted", "declined", "expired"]));
  });
});

describe("the Desk's pipeline", () => {
  test("groups by the follow-up clock: overdue leads, the clock stops while a change waits on us", async () => {
    const view = await pipeline(book, "open", NOW);
    const row = (ref: string) => view.groups.flatMap((g) => g.rows).find((r) => r.ref === ref)!;
    expect(view.groups.map((g) => g.key)).toEqual(["overdue", "due", "working", "decided"]);
    expect(row("Q-00003")).toMatchObject({ group: "overdue", chip: { words: "Day 7 was due yesterday" }, action: { kind: "send_video_ask", next: true } });
    expect(row("Q-00009")).toMatchObject({ group: "overdue", chip: { words: "Closes tomorrow, day 10" }, action: { kind: "last_ask" } });
    expect(row("Q-00004")).toMatchObject({ group: "due", chip: { words: "Day 3 due today" }, action: { kind: "send_check_in" } });
    // Sent three days ago, and still no follow-up: Holly's change is ours to answer first.
    expect(row("Q-00007")).toMatchObject({ group: "working", chip: { words: "Their change to answer" } });
    expect(row("Q-00012")).toMatchObject({ group: "working", chip: { words: "Day 3 due tomorrow" } });
    expect(row("Q-00013")).toMatchObject({ group: "working", total_cents: null, seen: "Not sent" });
    expect(row("Q-00005")).toMatchObject({ group: "decided", chip: { words: "Accepted → N-1035" } });
    expect(row("Q-00008")).toMatchObject({ group: "decided", chip: { words: "Too expensive" }, action: { kind: "rework" } });
    expect(view.overdue).toBe(2);
    // Exactly one orange line on the screen: the oldest overdue send.
    expect(view.groups.flatMap((g) => g.rows).filter((r) => r.action.next).map((r) => r.ref)).toEqual(["Q-00003"]);
  });

  test("counts, win rate and why we lose come from the quotes themselves", async () => {
    const view = await pipeline(book, "declined", NOW);
    expect(view.counts).toEqual({ open: 8, accepted: 2, declined: 1, expired: 1 });
    expect(view.month).toMatchObject({ won: 2, decided: 4, win_pct: 50 });
    expect(view.lost).toEqual([{ words: "No reply", count: 1 }, { words: "Too expensive", count: 1 }]);
    expect(view.flat.map((r) => r.ref)).toEqual(["Q-00008"]);
    keep("desk-pipeline", html(createElement(PipelineScreen, { view: await pipeline(book, "open", NOW), said: null, actions })));
    keep("desk-today", html(createElement(TodayScreen, { view: await pipeline(book, "open", NOW), orders: await board(mockOrders(() => NOW), "open", NOW), said: null, actions: { ...actions, place: noop } })));
  });
});

describe("the Desk's quote builder", () => {
  test("every price cell is Nelson's answer, untouched, with the staff view beside it", async () => {
    const view = (await builder(book, nelsonStaffConfig({}), "Q-00007", NOW))!;
    const nelson = fixture<StaffPrice>("price-response.staff.json");
    expect(view.nelson.ok).toBe(true);
    expect(view.totals).toEqual(nelson.totals);
    expect(view.staff_totals).toEqual(nelson.staff);
    expect(view.lines.map((l) => [l.id, l.unit_cents, l.setup_cents, l.line_total_cents, l.staff])).toEqual(nelson.lines.map((l) => [l.line_id, l.unit_cents, l.setup_cents, l.line_total_cents, l.staff]));
    expect(view.freight?.freight_options.map((o) => o.service)).toEqual(["economy", "express"]);
    expect(view.waiting.words).toBe("You · 1 change to answer · 1 with client");
    expect(view.changes.map((c) => c.state)).toEqual(["waiting", "suggested"]);
    const page = html(createElement(BuilderScreen, { view, said: null, actions }));
    // The Desk shows what the Portal never may. This is what the Portal's checks are measured against.
    for (const words of ["Amrod", "BH-0042", rand(3900), "52,95%", rand(579_900, { decimals: false }), "34,6%"]) expect(page, words).toContain(words);
    expect(page).toContain("Send v4");
    keep("desk-quote", page);
  });

  test("a line Nelson cannot price shows the sent figure and no made-up cost", async () => {
    const view = (await builder(book, nelsonStaffConfig({}), "Q-00012", NOW))!;
    expect(view.nelson.ok).toBe(false);
    expect(view.lines[0]).toMatchObject({ price: "frozen", staff: null, unit_cents: 19_500 });
    expect(view.staff_totals).toBeNull();
    expect(view.totals?.total_cents).toBe(630_000);
    const draft = (await builder(book, nelsonStaffConfig({}), "Q-00013", NOW))!;
    expect(draft.lines[0]).toMatchObject({ price: "none", unit_cents: null, staff: null });
    expect(draft.totals).toBeNull();
    expect(html(createElement(BuilderScreen, { view: draft, said: null, actions }))).toContain("Send v1");
  });

  test("when Nelson is down the builder says so and stands on the sent version", async () => {
    const down = { baseUrl: "http://nelson.mock", apiKey: "k", fetch: async () => new Response("{}", { status: 503 }) };
    const view = (await builder(book, down, "Q-00007", NOW))!;
    expect(view.nelson).toEqual({ ok: false, words: "Nelson did not answer. Showing the last sent version’s figures." });
    expect(view.lines.every((l) => l.staff === null && l.price === "frozen")).toBe(true);
    expect(view.totals?.total_cents).toBe(1_753_500);
  });

  test("an unknown quote is not found", async () => {
    expect(await builder(book, nelsonStaffConfig({}), "Q-99999", NOW)).toBeNull();
  });
});

describe("the official quote", () => {
  test("is made from a sent version, carries one total and says no VAT is charged", async () => {
    const quote = (await book.byRef("Q-00011"))!;
    const doc = quoteDocument(quote)!;
    expect(doc).toMatchObject({ ref: "Q-00011", version: 2, total_cents: 1_050_000, for: { company: "Haras Stud Farm" } });
    expect(doc.items.reduce((sum, i) => sum + i.amount_cents!, 0)).toBe(doc.total_cents);
    const page = html(createElement(DeskDocumentScreen, { doc, printButton: null }));
    expect(page).toContain("No VAT charged.");
    expect(page).not.toMatch(/VAT (details|number|registration|no\b)|incl\.? VAT|excl\.? VAT/i);
    expect(page).toContain(`valid to ${day(quote.valid_until)}`);
    keep("desk-pdf", page);
    expect(quoteDocument(quote, 1)!.version).toBe(1);
    expect(quoteDocument(quote, 9)).toBeNull();
  });

  test("a draft has no document", async () => {
    expect(quoteDocument((await book.byRef("Q-00013"))!)).toBeNull();
  });
});

describe("the Portal's quote screens", () => {
  test("the list is this client's sent quotes, by tab, with the one move each allows", async () => {
    const open = (await portalQuotes(book, MOCK_PORTAL_CLIENT_ID, "open", NOW))!;
    expect(open.counts).toEqual({ open: 3, accepted: 2, closed: 1 });
    expect(open.rows.map((r) => [r.ref, r.action.kind, r.chip.words])).toEqual([["Q-00014", "decide", "Ready to accept and pay"], ["Q-00012", "decide", "Ready to accept and pay"], ["Q-00007", "open", "1 change waiting on Nelson"]]);
    const closed = (await portalQuotes(book, MOCK_PORTAL_CLIENT_ID, "closed", NOW))!;
    expect(closed.rows.map((r) => [r.ref, r.action.kind])).toEqual([["Q-00001", "ask_again"]]);
    keep("portal-quotes", html(createElement(QuotesScreen, { view: open, said: null, reopen: noop })));
  });

  test("the real case: the Mother Moon Collection, twelve pieces, each with its mockup and its sent price", async () => {
    const view = (await portalQuote(book, MOCK_PORTAL_CLIENT_ID, "Q-00014", undefined, NOW))!;
    expect(view.lines).toHaveLength(12);
    expect(view.lines.every((l) => l.picture?.startsWith("data:image/jpeg;base64,"))).toBe(true);
    expect(view.lines.map((l) => l.unit_cents)).toEqual([7000, 13500, 13000, 12500, 14000, 16000, 17500, 14000, 9000, 14500, 17000, 46000]);
    expect(view.totals).toMatchObject({ setup_cents: 0, delivery_cents: 0, total_cents: 4_850_000 });
    expect(view.totals.total_cents).toBe(view.lines.reduce((sum, l) => sum + l.line_total_cents!, 0));
    const page = html(createElement(QuoteScreen, { view, said: null, takeSuggestion: noop, ask: noop, askForPick: noop }));
    expect(page.match(/<img /g)).toHaveLength(12);
    keep("portal-collection", page);
    const desk = (await builder(book, nelsonStaffConfig({}), "Q-00014", NOW))!;
    expect(desk.lines.every((l) => l.price === "frozen" && l.staff === null)).toBe(true); // no cost is invented for a real product
    keep("desk-collection", html(createElement(BuilderScreen, { view: desk, said: null, actions })));
  });

  test("a client tries quantities and drops pieces; every price is one Nelson already quoted", async () => {
    const sent = (await portalQuote(book, MOCK_PORTAL_CLIENT_ID, "Q-00014", undefined, NOW))!;
    expect(sent).toMatchObject({ picked: false, pick: {} });
    // 100 shoppers at the quoted R 50, the beach tote left out, and three things the quote does not allow.
    const asked = parsePick("ql_mm01:100,ql_mm03:0,ql_mm02:40,ql_zz99:25,ql_mm05:25,junk");
    const view = (await portalQuote(book, MOCK_PORTAL_CLIENT_ID, "Q-00014", undefined, NOW, asked))!;
    expect(view.pick).toEqual({ ql_mm01: 100, ql_mm03: 0 }); // 40 was never quoted, zz99 is not a line, 25 is no change
    expect(view.lines[0]).toMatchObject({ quantity: 100, unit_cents: 5000, line_total_cents: 500_000, left_out: false });
    expect(view.lines[2]).toMatchObject({ quantity: 0, line_total_cents: 0, left_out: true });
    expect(view.lines[1]).toMatchObject({ quantity: 25, unit_cents: 13_500 });
    expect(view.totals.total_cents).toBe(sent.totals.total_cents - 175_000 + 500_000 - 325_000);
    const page = html(createElement(QuoteScreen, { view, said: null, takeSuggestion: noop, ask: noop, askForPick: noop }));
    expect(page).toContain("Ask Nelson for this");
    expect(page).not.toContain(">Accept and pay<"); // a pick is a change: it is asked for, never paid for
    keep("portal-collection-pick", page);
    // A line with a change in flight cannot be picked, and an old version cannot be picked at all.
    const working = (await portalQuote(book, MOCK_PORTAL_CLIENT_ID, "Q-00007", undefined, NOW, parsePick("ql_cap01:50")))!;
    expect(working.lines.every((l) => !l.pickable)).toBe(true);
    expect(working.picked).toBe(false);
  });

  test("the quote shows live line states on the newest version and a frozen copy of an older one", async () => {
    const view = (await portalQuote(book, MOCK_PORTAL_CLIENT_ID, "Q-00007", undefined, NOW))!;
    expect(view).toMatchObject({ shown: 3, is_current: true, not_agreed: 2, waiting_on: "nelson", can: { acceptAndPay: false, change: true } });
    expect(view.lines.map((l) => [l.state_word, l.suggestion])).toEqual([["Your change · waiting on Nelson", null], ["Nelson suggests", "15 mm"]]);
    expect(view.lines[0]!.breaks).toEqual([{ quantity: 50, chosen: false }, { quantity: 100, chosen: true }, { quantity: 250, chosen: false }]);
    const page = html(createElement(QuoteScreen, { view, said: null, takeSuggestion: noop, ask: noop, askForPick: noop }));
    expect(page).toContain("2 items are waiting on an answer.");
    expect(page).not.toContain(">Accept and pay</a>"); // locked until every line reads Agreed
    keep("portal-quote", page);

    const old = (await portalQuote(book, MOCK_PORTAL_CLIENT_ID, "Q-00007", 2, NOW))!;
    expect(old).toMatchObject({ shown: 2, is_current: false, can: { change: false, acceptAndPay: false, decline: false } });
    expect(old.totals.total_cents).toBe(1_328_500);
    expect(old.lines.every((l) => l.suggestion === null)).toBe(true);
  });

  test("accept and pay opens on a Final quote, and the decline form asks the brief's six reasons", async () => {
    const view = (await portalDecide(book, MOCK_PORTAL_CLIENT_ID, "Q-00012"))!;
    expect(view).toMatchObject({ total_cents: 630_000, deposit: false, can: { acceptAndPay: true, decline: true } });
    expect(view.reasons.map((r) => r.value)).toEqual(["too_expensive", "timing", "went_elsewhere", "budget_cut", "just_exploring", "something_else"]);
    const page = html(createElement(DecideScreen, { view, said: null, accept: noop, decline: noop }));
    expect(page).toContain(`<b class="hero-total">${rand(630_000)}</b>`);
    expect(page).toContain(">Accept and pay</button>");
    keep("portal-decide", page);
    const working = (await portalDecide(book, MOCK_PORTAL_CLIENT_ID, "Q-00007"))!;
    expect(html(createElement(DecideScreen, { view: working, said: null, accept: noop, decline: noop }))).toContain("This unlocks when every item is agreed");
    keep("portal-document", html(createElement(DocumentScreen, { doc: quoteDocument((await book.byRef("Q-00012"))!)!, printButton: null })));
  });
});
