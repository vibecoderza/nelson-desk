// Phase 2 and 3, the order and proof screens on mock data. The board says whose move each order is, the target
// date counts working days from the signed proof, and every button runs the real state machines.
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { board, deskOrder } from "@/desk/orders.ts";
import { BoardScreen, DeskOrderScreen } from "@/desk/order-screens.tsx";
import { orderTransition } from "@/domain/order.ts";
import { PROOF_CHECKS, proofTransition } from "@/domain/proof.ts";
import { MOCK_PORTAL_CLIENT_ID, mockBook } from "@/mock/book.ts";
import { mockOrderList, mockOrders } from "@/mock/orders.ts";
import { targetDate } from "@/orders/book.ts";
import { addWorkingDays, daysBetween, isWorkingDay } from "@/orders/dates.ts";
import { steps } from "@/orders/words.ts";
import { portalCounts, portalHome, portalOrder, portalOrders, portalProof } from "@/portal/orders.ts";
import { HomeScreen, OrderScreen, OrdersScreen, ProofScreen } from "@/portal/order-screens.tsx";
import { day } from "@/ui/format.ts";

// A Saturday, early afternoon in SAST.
const NOW = new Date("2026-11-21T11:00:00Z");
const file = mockOrders(() => NOW);
const quotes = mockBook(() => NOW);
const noop = async () => {};
const deskActions = { approve: noop, sendBack: noop, place: noop, waybill: noop, delivered: noop, hold: noop, release: noop };
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const shots = process.env.SHOTS_DIR;
const keep = (name: string, markup: string) => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  writeFileSync(path.join(shots, `${name}.html`), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="ui.css"><body>${markup}`);
};

describe("working days", () => {
  test("weekends and South African public holidays do not count", () => {
    expect(isWorkingDay(new Date("2026-11-21T10:00:00Z"))).toBe(false); // Saturday
    expect(isWorkingDay(new Date("2026-12-16T10:00:00Z"))).toBe(false); // Day of Reconciliation
    expect(isWorkingDay(new Date("2026-08-10T10:00:00Z"))).toBe(false); // Women's Day, observed on the Monday
    expect(day(addWorkingDays(new Date("2026-11-20T10:00:00Z"), 1))).toBe("23 Nov");
    expect(day(addWorkingDays(new Date("2026-12-14T10:00:00Z"), 3))).toBe("18 Dec"); // steps over the 16th
    expect(daysBetween(new Date("2026-11-21T21:30:00Z"), new Date("2026-11-22T22:30:00Z"))).toBe(2); // SAST calendar days
  });

  test("the target is the sign date plus production plus transit, and moves a day for each day unsigned", () => {
    const [unsigned, signed] = [mockOrderList(NOW).find((o) => o.ref === "N-1035")!, mockOrderList(NOW).find((o) => o.ref === "N-1033")!];
    expect(day(targetDate(signed, NOW))).toBe(day(addWorkingDays(signed.proof.signed!.at, 9)));
    expect(day(targetDate(unsigned, NOW))).toBe("3 Dec"); // nine working days from Saturday 21 Nov
    expect(day(targetDate(unsigned, new Date("2026-11-23T11:00:00Z")))).toBe("4 Dec");
    const delivered = mockOrderList(NOW).find((o) => o.ref === "N-1019")!;
    expect(targetDate(delivered, NOW)).toEqual(delivered.shipment!.delivered_at);
  });
});

describe("the stand-in order file", () => {
  test("covers every step, and every order's states agree with each other", () => {
    const orders = mockOrderList(NOW);
    expect(new Set(orders.map((o) => o.state))).toEqual(new Set(["paid", "proof_with_nelson", "proof_with_client", "signed", "in_production", "dispatched", "delivered"]));
    for (const o of orders) {
      const proofSigned = ["signed", "in_production", "dispatched", "delivered"].includes(o.state);
      expect(o.proof.state === "signed", o.ref).toBe(proofSigned);
      expect(o.proof.signed !== null, o.ref).toBe(proofSigned);
      expect(o.shipment !== null, o.ref).toBe(o.state === "dispatched" || o.state === "delivered");
      expect(o.lines.reduce((sum, l) => sum + l.line_total_cents, 0), o.ref).toBe(o.total_cents);
    }
  });

  test("an accepted quote and its order point at each other", async () => {
    for (const q of (await quotes.all()).filter((x) => x.order_ref)) {
      const order = (await file.byRef(q.order_ref!))!;
      expect(order.quote_ref).toBe(q.ref);
      expect(order.client.id).toBe(q.client.id);
      expect(order.total_cents).toBe(q.versions.at(-1)!.totals.total_cents);
    }
  });
});

describe("the Desk's order board", () => {
  test("every open order sits under the one header that says whose move it is", async () => {
    const view = await board(file, "open", NOW);
    expect(view.counts).toEqual({ open: 7, done: 1 });
    const under = Object.fromEntries(view.groups.map((g) => [g.key, g.rows.map((r) => r.ref)]));
    expect(under).toEqual({ needs_you: ["N-1036", "N-1033", "N-1030", "N-1031"], with_client: ["N-1035"], in_the_works: ["N-1038"], on_the_road: ["N-1028"] });
    const row = (ref: string) => view.groups.flatMap((g) => g.rows).find((r) => r.ref === ref)!;
    expect(row("N-1033")).toMatchObject({ move: "place_order", action: { label: "Place order", place: true } });
    expect(row("N-1031")).toMatchObject({ move: "waybill", chip: { words: "Enter the waybill" } });
    expect(row("N-1030")).toMatchObject({ move: "held", chip: { tone: "bad", words: "On hold" } });
    expect(row("N-1035").chip.words).toBe("Proof out yesterday · not signed");
    keep("desk-orders", html(createElement(BoardScreen, { view, said: null, place: noop })));
    expect((await board(file, "done", NOW)).flat.map((r) => r.ref)).toEqual(["N-1019"]);
  });

  test("the order page leads with the one move, and each move passes the state machine", async () => {
    const moves: Record<string, Parameters<typeof orderTransition>[1]> = {
      "N-1036": { type: "proof_approved" }, "N-1033": { type: "supplier_order_placed" }, "N-1031": { type: "waybill_saved", waybill: "WB-1" }, "N-1028": { type: "delivery_confirmed" }, "N-1030": { type: "release" },
    };
    for (const [ref, event] of Object.entries(moves)) {
      const o = (await file.byRef(ref))!;
      expect(orderTransition({ state: o.state, onHold: o.hold !== null }, event, "staff").ok, ref).toBe(true);
      const view = (await deskOrder(file, ref, NOW))!;
      keep(`desk-order-${ref}`, html(createElement(DeskOrderScreen, { view, said: null, actions: deskActions })));
    }
    const page = html(createElement(DeskOrderScreen, { view: (await deskOrder(file, "N-1033", NOW))!, said: null, actions: deskActions }));
    expect(page).toContain("Place the supplier order");
    expect(page).not.toContain("Save waybill");
    // A held order does not move until it is released.
    const held = (await file.byRef("N-1030"))!;
    expect(orderTransition({ state: held.state, onHold: true }, { type: "waybill_saved", waybill: "WB-1" }, "staff")).toMatchObject({ ok: false, code: "on_hold" });
    expect(await deskOrder(file, "N-9999", NOW)).toBeNull();
  });
});

describe("the Portal's home, orders and proof", () => {
  test("home shows what needs the client first, then what is on its way", async () => {
    const view = (await portalHome(quotes, file, MOCK_PORTAL_CLIENT_ID, NOW))!;
    expect(view.needs.map((r) => r.key)).toEqual(["N-1035", "Q-00014", "Q-00007", "Q-00012"]);
    expect(view.needs[0]).toMatchObject({ next: { label: "Sign the proof", href: "/orders/N-1035/proof" } });
    expect(view.moving.map((r) => r.key)).toEqual(["N-1028"]);
    expect(await portalCounts(quotes, file, MOCK_PORTAL_CLIENT_ID)).toEqual({ quotes: 3, orders: 2 });
    keep("portal-home", html(createElement(HomeScreen, { view, said: null })));
  });

  test("an order says when it arrives, where it is, and the one thing to do", async () => {
    const list = (await portalOrders(file, MOCK_PORTAL_CLIENT_ID, "open", NOW))!;
    expect(list.rows.map((r) => [r.ref, r.when])).toEqual([["N-1035", "Arriving 3 Dec"], ["N-1028", `Arriving ${day(targetDate((await file.byRef("N-1028"))!, NOW))}`]]);
    keep("portal-orders", html(createElement(OrdersScreen, { view: list, said: null })));
    const toSign = (await portalOrder(file, MOCK_PORTAL_CLIENT_ID, "N-1035", NOW))!;
    expect(toSign.next).toEqual({ label: "Sign the proof", href: "/orders/N-1035/proof" });
    expect(toSign.steps.map((s) => s.at)).toEqual(["done", "now", "next", "next", "next", "next"]);
    expect(steps("delivered").every((s) => s.at === "done")).toBe(true);
    const onRoad = (await portalOrder(file, MOCK_PORTAL_CLIENT_ID, "N-1028", NOW))!;
    expect(onRoad.tracking!.steps[0]!.words).toBe("Out for delivery");
    for (const view of [toSign, onRoad, (await portalOrder(file, MOCK_PORTAL_CLIENT_ID, "N-1019", NOW))!]) keep(`portal-order-${view.ref}`, html(createElement(OrderScreen, { view, said: null, ask: noop })));
  });

  test("a proof is signed with four ticks, a name and a signature, by an Owner, against the sheet on screen", async () => {
    const view = (await portalProof(file, MOCK_PORTAL_CLIENT_ID, "N-1035", "owner", NOW))!;
    expect(view).toMatchObject({ can_sign: true, may_sign: true, proof_ref: "PP-1035", arriving: "3 Dec" });
    const page = html(createElement(ProofScreen, { view, said: null, sign: noop, askChange: noop }));
    for (const c of PROOF_CHECKS) expect(page).toContain(`name="${c}"`);
    keep("portal-proof", page);
    const o = (await file.byRef("N-1035"))!;
    const proof = { state: o.proof.state, round: o.proof.round, sheetSha256: o.proof.sheet_sha256 };
    const sign = (over: object) => proofTransition(proof, { type: "sign", role: "owner", name: "Holly Daniels", signature: "Holly Daniels", checks: PROOF_CHECKS, sheetSha256: view.sheet_sha256!, ...over }, "client");
    expect(sign({}).ok).toBe(true);
    expect(sign({ checks: PROOF_CHECKS.slice(1) })).toMatchObject({ ok: false, code: "checks_incomplete" });
    expect(sign({ role: "buyer" })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(sign({ sheetSha256: "0".repeat(64) })).toMatchObject({ ok: false, code: "sheet_changed" });
    expect(orderTransition({ state: o.state, onHold: false }, { type: "proof_signed" }, "client")).toMatchObject({ ok: true, value: { state: "signed" } });
    // A Buyer sees the proof and cannot sign it; a signed proof stays readable.
    expect(html(createElement(ProofScreen, { view: (await portalProof(file, MOCK_PORTAL_CLIENT_ID, "N-1035", "buyer", NOW))!, said: null, sign: noop, askChange: noop }))).toContain("Only an Owner");
    const signed = (await portalProof(file, MOCK_PORTAL_CLIENT_ID, "N-1028", "owner", NOW))!;
    expect(signed).toMatchObject({ can_sign: false, signed: { name: "Holly Daniels" } });
    keep("portal-proof-signed", html(createElement(ProofScreen, { view: signed, said: null, sign: noop, askChange: noop })));
  });
});

describe("the Desk's clients", () => {
  test("every client is one row, and the page holds all of theirs: orders, quotes, conversations", async () => {
    const { clients, clientPage } = await import("@/desk/clients.ts");
    const { ClientScreen, ClientsScreen } = await import("@/desk/client-screens.tsx");
    const list = await clients(quotes, file);
    expect(list.rows.length).toBe(7);
    expect(list.rows[0]).toMatchObject({ id: MOCK_PORTAL_CLIENT_ID, open_quotes: 3, open_orders: 2, paid_cents: 2_300_000 });
    keep("desk-clients", html(createElement(ClientsScreen, { view: list })));
    const view = (await clientPage(quotes, file, MOCK_PORTAL_CLIENT_ID, NOW))!;
    expect(view.orders.map((r) => r.ref)).toEqual(["N-1035", "N-1028", "N-1019"]);
    expect(view.quotes.length).toBe(6);
    expect(view).toMatchObject({ orders_count: 3, average_order_cents: 766_667, won: 2, decided: 3 });
    expect(view.messages.length).toBe(4);
    keep("desk-client", html(createElement(ClientScreen, { view, said: null, actions: { followUp: noop, rework: noop, place: noop, message: noop, sendQuote: noop } })));
    expect(view.sendable.map((q) => q.ref).sort()).toEqual(["Q-00007", "Q-00012", "Q-00014"]);
    expect(view.messages[0]!.at.getTime()).toBeLessThan(view.messages.at(-1)!.at.getTime());
    for (const id of ["c_nobody", "../etc", ""]) expect(await clientPage(quotes, file, id, NOW)).toBeNull();
  });
});

describe("the Desk's inbox", () => {
  test("what waits on us comes first, oldest at the top, with what was read from it", async () => {
    const { inbox, inbound } = await import("@/desk/inbox.ts");
    const { InboxScreen } = await import("@/desk/inbox-screens.tsx");
    const view = await inbox(quotes, file, NOW);
    expect(view.waiting.map((r) => r.id)).toEqual(["Q-00007", "in_3", "in_1", "in_2"]);
    expect(view.waiting.find((r) => r.id === "in_1")).toMatchObject({ client_id: null, can_start: true, artwork: true, read: "Caps × 80 · Paarl · by 12 Dec" });
    expect(view.waiting.find((r) => r.id === "in_3")).toMatchObject({ can_start: false, open: { label: "Reply" } });
    expect(view.answered.map((r) => r.id)).toEqual(["N-1035"]);
    // What the agent read is words, never a price.
    for (const m of inbound()) expect(m.read ?? "").not.toMatch(/R\s?\d/);
    keep("desk-inbox", html(createElement(InboxScreen, { view, said: null, start: noop })));
  });
});

describe("the Desk's back office", () => {
  test("business numbers are sums and counts of what is on file", async () => {
    const { business } = await import("@/desk/business.ts");
    const { BusinessScreen, SuppliersScreen } = await import("@/desk/back-office-screens.tsx");
    const { suppliers } = await import("@/desk/suppliers.ts");
    const view = await business(quotes, file, NOW);
    const all = mockOrderList(NOW);
    expect(view.month).toBe("November");
    expect(view.sales_cents).toBe(all.filter((o) => o.ref !== "N-1019").reduce((s, o) => s + o.total_cents, 0));
    expect(view.by_month.map((m) => m.month)).toEqual(["September", "November"]);
    expect(view.by_month.reduce((s, m) => s + m.sales_cents, 0)).toBe(all.reduce((s, o) => s + o.total_cents, 0));
    expect(view).toMatchObject({ orders: 7, won: 2, decided: 4 });
    keep("desk-business", html(createElement(BusinessScreen, { view })));
    const sup = await suppliers(file, NOW);
    expect(sup.rows[0]).toMatchObject({ name: "Amrod", how: "Prices by feed" });
    expect(sup.rows.flatMap((r) => r.with_them).length).toBe(7);
    expect(sup.requests.map((r) => r.chip.words)).toEqual(["Answer due in 4 h", "Answered in 19 h"]);
    keep("desk-suppliers", html(createElement(SuppliersScreen, { view: sup })));
  });
});

describe("the Portal's brand kit and artwork", () => {
  test("guesses are counted, a redrawn file stops asking, the main logo leads and tags filter", async () => {
    const { mockBrand } = await import("@/mock/brand.ts");
    const { portalArtwork, portalBrandKit } = await import("@/portal/brand.ts");
    const { ArtworkScreen, BrandKitScreen } = await import("@/portal/brand-screens.tsx");
    const kit = await portalBrandKit(mockBrand(), MOCK_PORTAL_CLIENT_ID, "Mother Moon Herbals", true);
    expect(kit).toMatchObject({ guesses: 4, draft: false, read: "Read from your brand guide (PDF) on 4 Nov" });
    expect(kit.colours[0]).toMatchObject({ title: "Moss", sub: "#4B5D43 · nearest thread: Deep moss green" });
    const page = html(createElement(BrandKitScreen, { view: kit, said: null, confirm: noop, readSite: noop }));
    expect(page.match(/Guess · confirm/g)!.length).toBe(4);
    expect(html(createElement(BrandKitScreen, { view: { ...kit, may_confirm: false }, said: null, confirm: noop, readSite: noop }))).not.toMatch(/>Confirm</);
    keep("portal-brand", page);
    const art = await portalArtwork(mockBrand(), MOCK_PORTAL_CLIENT_ID, "Mother Moon Herbals");
    expect(art.yours.map((r) => [r.id, r.chip.words, r.can_redraw, r.main])).toEqual([["af_moon_1", "Ready to print", false, true], ["af_moon_2", "Needs a redraw", true, false], ["af_moon_3", "Redrawn", false, false]]);
    expect(art.from_nelson.map((r) => [r.id, r.can_be_main])).toEqual([["af_moon_4", true]]);
    expect(art.filters.map((f) => `${f.label} ${f.count}`)).toEqual(["All 4", "Logos 3", "Patterns 1"]);
    expect((await portalArtwork(mockBrand(), MOCK_PORTAL_CLIENT_ID, "M", "pattern")).yours.map((r) => r.id)).toEqual(["af_moon_2"]);
    keep("portal-artwork", html(createElement(ArtworkScreen, { view: art, said: null, redraw: noop, makeMain: noop })));
  });

  test("a website is read into a name, a summary, colours with colour first, fonts and a logo", async () => {
    const { readSite } = await import("@/brand/read-site.ts");
    const { nearestThread } = await import("@/brand/threads.ts");
    const { portalSiteKit } = await import("@/portal/brand.ts");
    const { BrandKitScreen } = await import("@/portal/brand-screens.tsx");
    const page = `<html><head><title>Fynbos Coffee Co | Roasted in Stellenbosch</title>
      <meta property="og:description" content="Small-batch coffee roasted in Stellenbosch. Slow mornings, honest beans &amp; nothing rushed.">
      <meta name="theme-color" content="#1F4D3A"><link rel="stylesheet" href="/assets/site.css"><link rel="icon" href="/favicon.png">
      <style>body{font-family:"DM Sans",Arial,sans-serif;color:#222;background:#fff}h1{font-family:'Fraunces',serif}</style></head>
      <body><img class="site-logo" src="/img/fynbos-logo.png" alt="Fynbos"><img src="http://plain.example/logo.png" alt="logo"><p style="color:#C8102E">Sale</p></body></html>`;
    const css = "a{color:#D4A017}.btn{background:#D4A017;border-color:#d4a018}.x{color:#fff;background:#ffffff;border:1px solid #FFF}h2{font-family:Fraunces,serif}p{font-family:'DM Sans'}i{font-family:FontAwesome}u{color:rgba(0,0,0,.5)}";
    const read = readSite(page, [css], "https://fynboscoffee.co.za/");
    expect(read.name).toBe("Fynbos Coffee Co");
    expect(read.summary).toBe("Small-batch coffee roasted in Stellenbosch. Slow mornings, honest beans & nothing rushed.");
    expect(read.colours.slice(0, 3)).toEqual(["#1F4D3A", "#D4A017", "#C8102E"]);
    expect(read.colours).toContain("#FFFFFF");
    expect(read.fonts).toEqual(["DM Sans", "Fraunces"]);
    expect(read.logo_urls).toEqual(["https://fynboscoffee.co.za/img/fynbos-logo.png", "https://fynboscoffee.co.za/favicon.png"]);
    expect(read.sheet_urls).toEqual(["https://fynboscoffee.co.za/assets/site.css"]);
    expect([nearestThread("#1F4D3A"), nearestThread("#D4A017"), nearestThread("#fefefe")]).toEqual(["Forest green", "Gold", "White"]);
    const view = portalSiteKit("fynboscoffee.co.za", read, [], "Fynbos Coffee Co");
    expect(view).toMatchObject({ draft: true, may_confirm: false, read: "Read from fynboscoffee.co.za just now" });
    expect(view.colours.every((c) => !c.sure)).toBe(true);
    keep("portal-brand-read", html(createElement(BrandKitScreen, { view, said: null, confirm: noop, readSite: noop })));
  });
});
