// Nothing exposed, Portal side (North Star 3.10, brief 7.2 and 7.6).
// Every way data can reach a client is walked for Nelson's private keys and supplier names: the contract's customer
// shapes, the Nelson client, the event log, the outbox, the database role the Portal connects with, and the
// imports of every file that renders for a client.
//
// Every new public surface gets a check here. Never weaken these checks to make a build pass.
import { beforeAll, describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { PrismaClient } from "@/generated/prisma/client.ts";
import { assertPortalSafe, leaksIn, leaksInText, PRIVATE_KEY } from "@/exposure/private.ts";
import { fixture, fixtureIndex, loadSchemas } from "@/contract/load.ts";
import { priceForCustomer, type PriceRequest } from "@/nelson/client.ts";
import { customerViewOf } from "@/desk/nelson-staff.ts";
import { DESK_WORDS as LINE_DESK, PORTAL_WORDS as LINE_PORTAL } from "@/domain/line.ts";
import { PORTAL_WORDS as ORDER_PORTAL } from "@/domain/order.ts";
import { PORTAL_ROLE, PORTAL_VIEWS } from "@/portal/views.ts";
import { declineQuote } from "@/backbone/quote-decisions.ts";
import { tableColumns, wallsSql, INIT_SQL, WALLS_SQL } from "../scripts/build-walls.ts";
import { listen, MOCK_DESK_KEY } from "../mock/server.ts";
import { seedQuote, testDb } from "./helpers/db.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockBook, mockQuotes, MOCK_PORTAL_CLIENT_ID } from "@/mock/book.ts";
import { portalDecide, portalQuote, portalQuotes } from "@/portal/quotes.ts";
import { DecideScreen, DocumentScreen, QuoteScreen, QuotesScreen } from "@/portal/screens.tsx";
import { quoteDocument } from "@/quotes/document.ts";
import { builder } from "@/desk/quotes.ts";
import { nelsonStaffConfig } from "@/desk/mock-nelson-staff.ts";
import { BuilderScreen } from "@/desk/screens.tsx";
import { deskOrder } from "@/desk/orders.ts";
import { DeskOrderScreen } from "@/desk/order-screens.tsx";
import { mockOrderList, mockOrders } from "@/mock/orders.ts";
import { portalHome, portalOrder, portalOrders, portalProof } from "@/portal/orders.ts";
import { HomeScreen, OrderScreen, OrdersScreen, ProofScreen } from "@/portal/order-screens.tsx";
import { mockArtwork, mockBrand, mockKits } from "@/mock/brand.ts";
import { readSite } from "@/brand/read-site.ts";
import { portalArtwork, portalBrandKit, portalSiteKit } from "@/portal/brand.ts";
import { ArtworkScreen, BrandKitScreen } from "@/portal/brand-screens.tsx";
import { portalShop, shopItems } from "@/portal/shop.ts";
import { ShopScreen } from "@/portal/shop-screens.tsx";
import { portalSettings } from "@/portal/settings.ts";
import { SettingsScreen } from "@/portal/settings-screens.tsx";

const ROOT = path.resolve(import.meta.dirname, "..");
const STAFF_TABLES = ["quote_line_staff", "quote_version_staff", "order_line_staff", "supplier", "costing_request", "costing_answer", "outbox", "webhook_inbox", "agent", "agent_log", "audit_log", "staff_user", "setting", "client_note", "brief", "enquiry", "follow_up", "template", "client_source"];

describe("the walker itself", () => {
  test("it is live: the staff price fixture is full of private keys and names a supplier", () => {
    const leaks = leaksIn(fixture("price-response.staff.json"));
    const kinds = new Set(leaks.map((l) => l.kind));
    expect(kinds.has("private_key")).toBe(true);
    expect(kinds.has("supplier_name")).toBe(true);
    for (const key of ["staff", "supplier", "supplier_code", "stock", "incoming_stock", "unit_cost_cents", "branding_cost_cents", "markup_applied_pct", "margin_cents", "margin_pct", "cost_cents"]) {
      expect(leaks.some((l) => l.value === key), `${key} was not caught`).toBe(true);
    }
  });

  test("it catches each kind of leak, wherever it sits", () => {
    expect(leaksIn({ lines: [{ note: { text: "Ships from Amrod on Monday" } }] })[0]).toMatchObject({ kind: "supplier_name", path: "$.lines[0].note.text" });
    expect(leaksIn({ image: "https://cdn.amrcdn.com/x.jpg" })[0]!.kind).toBe("supplier_host");
    expect(leaksIn({ ref: "SO-88214" })[0]!.kind).toBe("supplier_ref");
    for (const key of ["cost", "unit_cost_cents", "margin_pct", "markup", "mark_up_pct", "supplier", "supplierless_supplier_code", "tier", "price_book", "stock", "staff"]) {
      expect(leaksIn({ [key]: 1 }).length, key).toBe(1);
    }
    // Words that look close and are not private.
    for (const key of ["book_hex", "costing_note", "stockist", "staffing", "source", "unit_cents", "total_cents", "setup_cents"]) expect(leaksIn({ [key]: 1 }), key).toEqual([]);
    expect(leaksInText("<p>Your caps are with KMQ for embroidery.</p>")[0]!.kind).toBe("supplier_name");
    expect(leaksInText("<p>Your caps are in production. Target 4 December.</p>")).toEqual([]);
    expect(() => assertPortalSafe({ margin_cents: 1 }, "a test value")).toThrow(/would expose private_key/);
  });
});

describe("the contract's customer shapes", () => {
  test("every fixture a client may receive is clean", () => {
    const index = fixtureIndex();
    expect(index.portal_safe.length).toBeGreaterThanOrEqual(5);
    for (const name of index.portal_safe) expect(leaksIn(fixture(name)), name).toEqual([]);
  });

  test("the customer price schema cannot hold a staff field: no private property, and unknown properties are refused", () => {
    const { ajv } = loadSchemas();
    const names: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.properties && typeof n.properties === "object") {
        names.push(...Object.keys(n.properties as object));
        expect(n.additionalProperties, "an object in the customer schema accepts unknown properties").toBe(false);
      }
      for (const v of Object.values(n)) walk(v);
    };
    walk(fixture("../schemas/price-response-customer.json"));
    expect(names.length).toBeGreaterThan(10);
    expect(names.filter((k) => PRIVATE_KEY.test(k))).toEqual([]);
    const validate = ajv.getSchema("https://contract.dearnelson.co.za/v1/price-response-customer.json")!;
    expect(validate(fixture("price-response.customer.json"))).toBe(true);
    expect(validate(fixture("price-response.staff.json"))).toBe(false); // the staff answer is not a valid customer answer
    const smuggled = fixture<{ lines: Record<string, unknown>[] }>("price-response.customer.json");
    smuggled.lines[0]!.unit_cost_cents = 3900;
    expect(validate(smuggled)).toBe(false);
  });

  test("the customer view made from a staff answer is clean", () => {
    expect(leaksIn(customerViewOf(fixture("price-response.staff.json")))).toEqual([]);
  });

  test("the Nelson client refuses to pass on a customer price that carries staff data", async () => {
    const { server, url } = await listen();
    try {
      const request = fixture<PriceRequest>("price-request.json");
      expect(leaksIn(await priceForCustomer({ baseUrl: url, apiKey: MOCK_DESK_KEY }, request))).toEqual([]);
      // Nelson misbehaves: the customer call answers with the staff view.
      const leaky = (async () => new Response(JSON.stringify({ ...fixture<object>("price-response.staff.json"), view: "customer" }), { status: 200 })) as unknown as typeof fetch;
      await expect(priceForCustomer({ baseUrl: url, apiKey: MOCK_DESK_KEY, fetch: leaky }, request)).rejects.toThrow(/would expose/);
      const wrongView = (async () => new Response(JSON.stringify(fixture("price-response.staff.json")), { status: 200 })) as unknown as typeof fetch;
      await expect(priceForCustomer({ baseUrl: url, apiKey: MOCK_DESK_KEY, fetch: wrongView }, request)).rejects.toThrow(/another view/);
    } finally { await new Promise<void>((done) => server.close(() => done())); }
  });
});

describe("words a client reads", () => {
  test("the portal's state words name no supplier, and never say what the Desk says about suppliers", () => {
    for (const words of [...Object.values(LINE_PORTAL), ...Object.values(ORDER_PORTAL)]) {
      expect(leaksInText(words)).toEqual([]);
      expect(words).not.toMatch(/supplier|costing|margin|cost\b/i);
    }
    expect(LINE_DESK.waiting_on_supplier).toMatch(/costing/i); // the Desk does say it
  });
});

describe("the database wall", () => {
  let pg: PGlite, db: PrismaClient;
  beforeAll(async () => {
    ({ pg, db } = await testDb());
    await seedQuote(db);
    await declineQuote(db, new Date("2026-11-21T08:00:00Z"), { ref: "Q-00007", actor: "client", reason: "timing" });
    await db.event.create({ data: { id: "ev_STAFFONLY00001", type: "cost.moved", subject_type: "cost", subject_id: "2026-11-21", audience: "staff", data: { change_pct: 6.1 }, actor: "auto", occurred_at: new Date() } });
    await db.notification.create({ data: { id: "n_1", event_id: "ev_STAFFONLY00001", party: "supplier", channel: "email", template_key: "costing_pack" } });
  });
  const asPortal = async <T>(sql: string): Promise<T[]> => {
    await pg.exec(`SET ROLE ${PORTAL_ROLE}`);
    try { return (await pg.query<T>(sql)).rows; } finally { await pg.exec("RESET ROLE"); }
  };

  test("the walls migration is exactly what the allow-list generates", () => {
    expect(readFileSync(WALLS_SQL, "utf8")).toBe(wallsSql(readFileSync(INIT_SQL, "utf8")));
  });

  test("no staff table is on the Portal's allow-list, and every staff table exists", () => {
    const tables = tableColumns(readFileSync(INIT_SQL, "utf8"));
    for (const t of STAFF_TABLES) {
      expect(tables.has(t), `${t} is not a table`).toBe(true);
      expect(Object.keys(PORTAL_VIEWS)).not.toContain(t);
    }
    for (const t of Object.keys(PORTAL_VIEWS)) expect(t).not.toMatch(/staff|supplier|costing|agent|audit|outbox|inbox/);
    // Every table is accounted for: on the allow-list or named staff-only. A new table has to be placed on purpose.
    expect([...Object.keys(PORTAL_VIEWS), ...STAFF_TABLES].sort()).toEqual([...tables.keys()].sort());
  });

  test("no column the Portal can read has a private name", async () => {
    const columns = (await pg.query<{ table_name: string; column_name: string }>("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'portal'")).rows;
    expect(columns.length).toBeGreaterThan(200);
    expect(columns.filter((c) => PRIVATE_KEY.test(c.column_name)).map((c) => `${c.table_name}.${c.column_name}`)).toEqual([]);
    expect(columns.some((c) => c.column_name === "upload_token_hash")).toBe(false);
  });

  test("the Portal's role reads its views and cannot touch a single table", async () => {
    expect((await asPortal<{ ref: string }>('SELECT ref FROM portal.quote'))[0]!.ref).toBe("Q-00007");
    expect((await asPortal('SELECT * FROM portal.quote_line')).length).toBe(2);
    const tables = [...tableColumns(readFileSync(INIT_SQL, "utf8")).keys()];
    for (const t of tables) await expect(asPortal(`SELECT * FROM public."${t}"`), `public.${t} is readable`).rejects.toThrow(/permission denied/);
    for (const t of STAFF_TABLES) await expect(asPortal(`SELECT * FROM portal."${t}"`), `portal.${t} exists`).rejects.toThrow(/does not exist/);
    // The owner still can: the check above is live.
    expect((await pg.query("SELECT supplier FROM quote_line_staff")).rows.length).toBe(2);
  });

  test("the Portal's role cannot write, cannot make its own views and cannot become the owner", async () => {
    await expect(asPortal("UPDATE portal.quote SET state = 'accepted'")).rejects.toThrow(/permission denied/);
    await expect(asPortal("DELETE FROM portal.event")).rejects.toThrow(/permission denied/);
    await expect(asPortal("CREATE VIEW portal.peek AS SELECT * FROM public.quote_line_staff")).rejects.toThrow(/permission denied/);
    await expect(asPortal("CREATE TABLE public.peek (id int)")).rejects.toThrow(/permission denied/);
  });

  test("everything the Portal's role can read, row by row, is clean", async () => {
    let rows = 0;
    for (const view of Object.keys(PORTAL_VIEWS)) {
      for (const row of await asPortal<Record<string, unknown>>(`SELECT * FROM portal."${view}"`)) {
        rows += 1;
        expect(leaksIn(row), `portal.${view}`).toEqual([]);
      }
    }
    expect(rows).toBeGreaterThan(5);
  });

  test("the Portal sees client events and client messages only", async () => {
    const events = await asPortal<{ type: string }>("SELECT type FROM portal.event");
    expect(events.map((e) => e.type)).toEqual(["quote.declined"]);
    expect((await pg.query("SELECT 1 FROM event")).rows.length).toBe(2);
    expect(await asPortal("SELECT * FROM portal.notification")).toEqual([]); // the supplier's message is not the client's
  });

  test("a draft quote version is Nelson's until it is sent", async () => {
    await db.quoteVersion.create({ data: { id: "qv_draft", quote_id: "q_1", version: 4, snapshot: {}, price_customer: {}, price_version: "pv", total_cents: 1 } });
    expect(await asPortal("SELECT * FROM portal.quote_version")).toEqual([]);
    await db.quoteVersion.update({ where: { id: "qv_draft" }, data: { sent_at: new Date() } });
    expect((await asPortal("SELECT * FROM portal.quote_version")).length).toBe(1);
  });
});

describe("the code a client's pages can load", () => {
  // Every module reachable from the Portal's entry points, by following relative and @/ imports.
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? path.join(ROOT, "src", spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    return null;
  };
  const filesUnder = (dir: string): string[] => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
  const reachable = (entries: string[]): Set<string> => {
    const seen = new Set<string>(), stack = [...entries];
    while (stack.length) {
      const file = stack.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const [, spec] of readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
        const next = resolve(file, spec!);
        if (next) stack.push(next);
      }
    }
    return seen;
  };
  const rel = (f: string) => path.relative(ROOT, f);
  const portalEntries = [...filesUnder(path.join(ROOT, "app/portal")), ...filesUnder(path.join(ROOT, "src/portal")), path.join(ROOT, "src/nelson/client.ts")];

  test("no Portal file reaches Desk-only code or the staff view of the price", () => {
    const seen = reachable(portalEntries);
    expect(seen.size).toBeGreaterThan(portalEntries.length); // the walk followed something
    expect([...seen].map(rel).filter((f) => f.startsWith("src/desk/") || f.startsWith("app/desk/"))).toEqual([]);
    // The walk is live: the Desk's own staff module is reachable from a Desk entry.
    expect([...reachable([path.join(ROOT, "src/desk/nelson-staff.ts")])].map(rel)).toContain("src/nelson/client.ts");
  });

  test("no Portal file names a staff table, the staff key or the owner database", () => {
    for (const file of portalEntries.filter((f) => !f.endsWith(path.join("portal", "views.ts")) && !f.endsWith(path.join("nelson", "client.ts")))) {
      const src = readFileSync(file, "utf8");
      expect(src, rel(file)).not.toMatch(/quote_line_staff|quoteLineStaff|quote_version_staff|quoteVersionStaff|order_line_staff|orderLineStaff/);
      expect(src, rel(file)).not.toMatch(/NELSON_STAFF_API_KEY|view=staff|deskDb\(|DATABASE_URL(?!_PORTAL)/);
    }
    expect(readFileSync(path.join(ROOT, "src/nelson/client.ts"), "utf8")).not.toMatch(/view=staff|NELSON_STAFF_API_KEY/);
  });

  test("nothing that runs in a browser can load the database, the backbone, the Desk or a secret", () => {
    const client = [...filesUnder(path.join(ROOT, "app")), ...filesUnder(path.join(ROOT, "src"))].filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    for (const file of client) {
      const seen = [...reachable([file])].map(rel);
      expect(seen.filter((f) => /^src\/(db|backbone|desk|generated|events\/signing)/.test(f)), rel(file)).toEqual([]);
      expect(readFileSync(file, "utf8"), rel(file)).not.toMatch(/process\.env\.(?!NEXT_PUBLIC_)/);
    }
  });

  test("no formula lives here: the Desk holds no mark-up, multiplier or rounding ladder", () => {
    const sources = [...filesUnder(path.join(ROOT, "src")), ...filesUnder(path.join(ROOT, "app"))].filter((f) => !rel(f).startsWith("src/generated/"));
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources) {
      const src = readFileSync(file, "utf8").replace(/\/\/.*$/gm, "");
      expect(src, rel(file)).not.toMatch(/\b1\.15\b|\b1\.33\b|\b1\.5295\b|52\.95/);
      expect(src, rel(file)).not.toMatch(/cost\w*\s*\*\s*[\d(]|\*\s*\(?\s*1\s*\+\s*mark/i); // a cost times a number
      expect(src, rel(file)).not.toMatch(/Math\.(round|ceil|floor)\([^)]*(cost|markup|margin)/i);
    }
  });

  test("builds ship no source maps and no stand-in sign-in", () => {
    const config = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
    expect(config).toMatch(/productionBrowserSourceMaps:\s*false/);
    expect(config.replace(/productionBrowserSourceMaps:\s*false/, "")).not.toMatch(/sourcemap|devtool/i);
    expect(config).toMatch(/NEXT_PUBLIC_CLERK_KEYLESS_DISABLED:\s*"true"/);
    expect(config).toMatch(/poweredByHeader:\s*false/);
  });

  test("no secret value and no environment file is in the repository", () => {
    const tracked = ["CLAUDE.md", "README.md", ".env.example", "proxy.ts", "next.config.ts", "vercel.json", ...filesUnder(path.join(ROOT, "src")).map(rel), ...filesUnder(path.join(ROOT, "app")).map(rel)].filter((f) => !f.startsWith("src/generated/") && existsSync(path.join(ROOT, f)));
    for (const file of tracked) {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      expect(src, file).not.toMatch(/sk_(live|test)_[A-Za-z0-9]{10,}|pk_(live|test)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}|postgres(ql)?:\/\/[^\s"'`]+:[^\s"'`@]+@(?!localhost)/);
    }
    for (const line of readFileSync(path.join(ROOT, ".env.example"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))) {
      const [name, value] = line.split("=");
      if (!/_HOST$/.test(name!)) expect(value, `${name} has a value in .env.example`).toBe("");
    }
    expect(readFileSync(path.join(ROOT, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
  });
});

// Phase 1: the quote screens. Every view a client can open, and the page drawn from it, is walked the same way.
describe("the quote screens a client can open", () => {
  const NOW = new Date("2026-11-21T11:00:00Z");
  const book = mockBook(() => NOW);
  const noop = async () => {};
  // Words that belong to the Desk alone. None may appear on a page a client reads.
  const STAFF_WORDS = /\b(margin|mark-?up|supplier|stock|cost|costs|costing)\b/i;
  const clean = (what: string, view: unknown, page: string) => {
    expect(leaksIn(view), what).toEqual([]);
    expect(leaksInText(page), what).toEqual([]);
    expect(page.match(STAFF_WORDS)?.[0] ?? null, what).toBeNull();
  };

  test("the stand-in book holds the customer view only", () => {
    expect(leaksIn(mockQuotes(NOW))).toEqual([]);
  });

  test("the list, every quote, every version, the decision page and the official quote are clean, as data and as HTML", async () => {
    let pages = 0;
    for (const quote of mockQuotes(NOW).filter((q) => q.state !== "draft")) {
      const client = quote.client.id;
      for (const tab of ["open", "accepted", "closed"] as const) {
        const view = (await portalQuotes(book, client, tab, NOW))!;
        clean(`${client} ${tab}`, view, renderToStaticMarkup(createElement(QuotesScreen, { view, said: null, reopen: noop })));
      }
      for (const v of [undefined, ...quote.versions.map((x) => x.version)]) {
        const view = (await portalQuote(book, client, quote.ref, v, NOW))!;
        clean(`${quote.ref} v${v ?? "latest"}`, view, renderToStaticMarkup(createElement(QuoteScreen, { view, said: null, takeSuggestion: noop, ask: noop, askForPick: noop })));
        const doc = quoteDocument(quote, v)!;
        clean(`${quote.ref} document v${v ?? "latest"}`, doc, renderToStaticMarkup(createElement(DocumentScreen, { doc, printButton: null })));
        pages += 2;
      }
      const decide = (await portalDecide(book, client, quote.ref))!;
      clean(`${quote.ref} decide`, decide, renderToStaticMarkup(createElement(DecideScreen, { view: decide, said: null, accept: noop, decline: noop })));
    }
    expect(pages).toBeGreaterThan(30);
  });

  test("the check is live: the Desk's builder, drawn the same way, trips every part of it", async () => {
    const view = (await builder(book, nelsonStaffConfig({}), "Q-00007", NOW))!;
    const page = renderToStaticMarkup(createElement(BuilderScreen, { view, said: null, actions: { answer: noop, send: noop, reply: noop } }));
    expect(leaksIn(view).some((l) => l.kind === "private_key")).toBe(true);
    expect(leaksInText(page).some((l) => l.kind === "supplier_name")).toBe(true);
    expect(page).toMatch(STAFF_WORDS);
  });

  test("a client reaches their own sent quotes and nothing else: not a draft, not another client's", async () => {
    // Q-00003 belongs to another client; Q-00013 is a draft; Q-99999 does not exist. All three look the same.
    for (const ref of ["Q-00003", "Q-00013", "Q-99999"]) {
      expect(await portalQuote(book, MOCK_PORTAL_CLIENT_ID, ref, undefined, NOW), ref).toBeNull();
      expect(await portalDecide(book, MOCK_PORTAL_CLIENT_ID, ref), ref).toBeNull();
    }
    expect(await portalQuote(book, "c_karoo", "Q-00013", undefined, NOW)).toBeNull(); // its own draft, still Nelson's
    expect(await portalQuotes(book, "c_karoo", "open", NOW)).toBeNull();
    const refs = (await Promise.all((["open", "accepted", "closed"] as const).map((t) => portalQuotes(book, MOCK_PORTAL_CLIENT_ID, t, NOW)))).flatMap((v) => v!.rows.map((r) => r.ref));
    expect(refs.sort()).toEqual(["Q-00001", "Q-00002", "Q-00005", "Q-00007", "Q-00012", "Q-00014"]);
  });

  test("the Portal's pages and actions check whose quote it is before anything else", () => {
    const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
    expect(read("app/portal/quotes/[ref]/document/page.tsx")).toMatch(/quote\.client\.id === clientId && quote\.state !== "draft"/);
    const actions = read("src/portal/actions.ts");
    expect(actions).toMatch(/quote\.client\.id === portalClientId\(\) && quote\.state !== "draft"/);
    // Every exported action starts from the client's own quote.
    const exported = [...actions.matchAll(/export async function (\w+)\(form: FormData\): Promise<void> \{\n\s+const q = await ownQuote\(form\);/g)].map((m) => m[1]);
    expect(exported.sort()).toEqual([...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]).sort());
    expect(exported.length).toBeGreaterThanOrEqual(5);
  });

  test("the staff price fixture and the staff key are named under src/desk only", () => {
    const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
    const naming = [...walk("src"), ...walk("app")].filter((f) => !f.startsWith(path.join("src", "generated")) && /price-response\.staff|NELSON_STAFF_API_KEY|INLINE_STAFF_KEY\b.*inlineNelson\(\{/.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(naming.length).toBeGreaterThan(0);
    expect(naming.filter((f) => !f.startsWith(path.join("src", "desk")))).toEqual([]);
  });

  test("the one script that runs in a browser is a print button with no data in it", () => {
    const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
    const client = [...walk("src"), ...walk("app")].filter((f) => /^\s*["']use client["']/.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(client).toEqual([path.join("src", "ui", "print-button.tsx")]);
    expect(readFileSync(path.join(ROOT, client[0]!), "utf8")).not.toMatch(/import /);
  });
});

describe("the order and proof screens a client can open", () => {
  const NOW = new Date("2026-11-21T11:00:00Z");
  const file = mockOrders(() => NOW);
  const quotes = mockBook(() => NOW);
  const noop = async () => {};
  const STAFF_WORDS = /\b(margin|mark-?up|supplier|stock|cost|costs|costing|print house)\b/i;
  const clean = (what: string, view: unknown, page: string) => {
    expect(leaksIn(view), what).toEqual([]);
    expect(leaksInText(page), what).toEqual([]);
    expect(page.match(STAFF_WORDS)?.[0] ?? null, what).toBeNull();
  };

  test("the stand-in order file holds the customer view only", () => {
    expect(leaksIn(mockOrderList(NOW))).toEqual([]);
  });

  test("home, both order lists, every order and every proof are clean for every client, as data and as HTML", async () => {
    let pages = 0;
    for (const order of mockOrderList(NOW)) {
      const client = order.client.id;
      const home = (await portalHome(quotes, file, client, NOW))!;
      clean(`${client} home`, home, renderToStaticMarkup(createElement(HomeScreen, { view: home, said: null })));
      for (const tab of ["open", "done"] as const) {
        const view = (await portalOrders(file, client, tab, NOW))!;
        clean(`${client} orders ${tab}`, view, renderToStaticMarkup(createElement(OrdersScreen, { view, said: null })));
      }
      const view = (await portalOrder(file, client, order.ref, NOW))!;
      clean(order.ref, view, renderToStaticMarkup(createElement(OrderScreen, { view, said: null, ask: noop })));
      const proof = await portalProof(file, client, order.ref, "owner", NOW);
      if (proof) clean(`${order.ref} proof`, proof, renderToStaticMarkup(createElement(ProofScreen, { view: proof, said: null, sign: noop, askChange: noop })));
      pages += proof ? 2 : 1;
    }
    expect(pages).toBeGreaterThan(12);
  });

  test("the check is live: the Desk's order page, drawn the same way, trips every part of it", async () => {
    const view = (await deskOrder(file, "N-1031", NOW))!;
    const page = renderToStaticMarkup(createElement(DeskOrderScreen, { view, said: null, actions: { approve: noop, sendBack: noop, place: noop, waybill: noop, delivered: noop, hold: noop, release: noop } }));
    expect(leaksIn(view).map((l) => l.kind).sort()).toEqual(expect.arrayContaining(["private_key", "supplier_name", "supplier_ref"]));
    expect(leaksInText(page).map((l) => l.kind)).toEqual(expect.arrayContaining(["supplier_name", "supplier_ref"]));
    expect(page).toMatch(STAFF_WORDS);
  });

  test("a client reaches their own orders and nothing else, and a proof only once Nelson has sent it", async () => {
    // N-1031 belongs to another client; N-9999 does not exist. Both look the same.
    for (const ref of ["N-1031", "N-9999"]) {
      expect(await portalOrder(file, MOCK_PORTAL_CLIENT_ID, ref, NOW), ref).toBeNull();
      expect(await portalProof(file, MOCK_PORTAL_CLIENT_ID, ref, "owner", NOW), ref).toBeNull();
    }
    expect(await portalProof(file, "c_lagom", "N-1036", "owner", NOW)).toBeNull(); // their own, still with Nelson
    expect(await portalProof(file, "c_capepoint", "N-1038", "owner", NOW)).toBeNull(); // no sheet yet
    expect(await portalOrders(file, "c_nobody", "open", NOW)).toBeNull();
    const refs = (await Promise.all((["open", "done"] as const).map((t) => portalOrders(file, MOCK_PORTAL_CLIENT_ID, t, NOW)))).flatMap((v) => v!.rows.map((r) => r.ref));
    expect(refs.sort()).toEqual(["N-1019", "N-1028", "N-1035"]);
  });

  test("the Portal's order pages and actions check whose order it is before anything else", () => {
    const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
    const actions = read("src/portal/order-actions.ts");
    expect(actions).toMatch(/order && order\.client\.id === portalClientId\(\) \? order : null/);
    const exported = [...actions.matchAll(/export async function (\w+)\(form: FormData\): Promise<void> \{\n\s+const o = await ownOrder\(form\);/g)].map((m) => m[1]);
    expect(exported.sort()).toEqual([...actions.matchAll(/export (?:async function|const) (\w+)/g)].map((m) => m[1]).sort());
    expect(exported).toEqual(expect.arrayContaining(["signProof", "askForProofChange", "askOnOrder"]));
    // Every view the pages read refuses another client's order itself.
    const views = read("src/portal/orders.ts");
    expect(views.match(/o\.client\.id !== clientId/g)!.length).toBe(2);
    expect(views.match(/assertPortalSafe\(/g)!.length).toBe(4);
    // The supply side of an order is named under src/desk only.
    const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
    const naming = [...walk("src"), ...walk("app")].filter((f) => /order-supply|supplyFor/.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(naming.length).toBeGreaterThan(0);
    expect(naming.filter((f) => !f.startsWith(path.join("src", "desk")))).toEqual([]);
  });
});

describe("the brand kit and artwork a client can open", () => {
  const file = mockBrand();
  const noop = async () => {};
  const STAFF_WORDS = /\b(margin|mark-?up|supplier|stock|stocks|cost|costs|costing|print house)\b/i;
  const kitPage = (view: Awaited<ReturnType<typeof portalBrandKit>>) => renderToStaticMarkup(createElement(BrandKitScreen, { view, said: null, confirm: noop, readSite: noop }));
  const artPage = (view: Awaited<ReturnType<typeof portalArtwork>>) => renderToStaticMarkup(createElement(ArtworkScreen, { view, said: null, redraw: noop, makeMain: noop }));
  const clean = (what: string, view: unknown, page: string) => {
    expect(leaksIn(view), what).toEqual([]);
    expect(leaksInText(page), what).toEqual([]);
    expect(page.match(STAFF_WORDS)?.[0] ?? null, what).toBeNull();
  };

  test("the stand-in brand file holds the customer view only", () => {
    expect(leaksIn(mockKits())).toEqual([]);
    expect(leaksIn(mockArtwork())).toEqual([]);
  });

  test("the brand kit, a kit read from a website and the artwork are clean for every client, as data and as HTML", async () => {
    for (const client of ["c_mothermoon", "c_lagom", "c_nobody"]) {
      const kit = await portalBrandKit(file, client, "A client", true);
      clean(`${client} kit`, kit, kitPage(kit));
      for (const tag of ["all", "logo", "pattern"] as const) {
        const art = await portalArtwork(file, client, "A client", tag);
        clean(`${client} artwork ${tag}`, art, artPage(art));
      }
    }
    const read = readSite('<title>Shop | Brand</title><meta name="description" content="Tea."><style>a{color:#4B5D43;font-family:Karla,sans-serif}</style>', [], "https://brand.co.za/");
    const draft = portalSiteKit("brand.co.za", read, [], "A client");
    clean("a kit read from a website", draft, kitPage(draft));
  });

  test("a client sees their own kit and files and nothing else", async () => {
    const moon = await portalArtwork(file, "c_mothermoon", "Mother Moon Herbals");
    expect([...moon.yours, ...moon.from_nelson].map((r) => r.id).sort()).toEqual(["af_moon_1", "af_moon_2", "af_moon_3", "af_moon_4"]);
    const lagom = await portalArtwork(file, "c_lagom", "Lagom Studio");
    expect(lagom.yours.map((r) => r.id)).toEqual(["af_lagom_1"]);
    const nobody = await portalBrandKit(file, "c_nobody", "Nobody", true);
    expect([nobody.read, nobody.colours.length, nobody.fonts.length, nobody.rules.length]).toEqual([null, 0, 0, 0]);
    expect((await portalArtwork(file, "c_nobody", "Nobody")).yours).toEqual([]);
    // A file that leaks across in the store is still dropped by the view.
    const crossed = { ...file, artworkFor: async () => mockArtwork(), kitFor: async () => mockKits()[1]! };
    expect((await portalArtwork(crossed, "c_mothermoon", "M")).yours.map((r) => r.id)).not.toContain("af_lagom_1");
    expect((await portalBrandKit(crossed, "c_mothermoon", "M", true)).read).toBeNull();
  });

  test("the brand actions find the thing among the client's own before anything else", () => {
    const actions = readFileSync(path.join(ROOT, "src/portal/brand-actions.ts"), "utf8");
    const owned = [...actions.matchAll(/export async function (\w+)\(form: FormData\): Promise<void> \{\n\s+const \w+ = await own(?:Artwork|KitItem)\(form\);/g)].map((m) => m[1]);
    expect(owned.sort()).toEqual(["askForRedraw", "confirmKitItem", "makeMainLogo"]);
    // The one action that touches nothing on file only checks an address and opens a page.
    expect([...actions.matchAll(/export (?:async function|const) (\w+)/g)].map((m) => m[1]).sort()).toEqual([...owned, "readWebsite"].sort());
    expect(actions).toMatch(/export async function readWebsite\(form: FormData\): Promise<void> \{\n\s+const host = siteHost\(text\(form, "site"\)\);\n\s+if \(!host\) return back\([^\n]+\n\s+return redirect\(`\/brand\?site=\$\{encodeURIComponent\(host\)\}`\);\n\}/);
    expect(actions.match(/portalClientId\(\)/g)!.length).toBeGreaterThanOrEqual(4);
    const views = readFileSync(path.join(ROOT, "src/portal/brand.ts"), "utf8");
    expect(views.match(/client\.id [!=]== clientId/g)!.length).toBe(2);
    expect(views.match(/assertPortalSafe\(/g)!.length).toBe(4);
  });

  test("the website reader only ever asks a public https host, and sends nothing of ours", async () => {
    const { siteHost } = await import("@/brand/read-site.ts");
    for (const bad of ["localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254", "[::1]", "desk.internal", "nelson.local", "a b.com", "user:pw@site.com", "site.com:8080", "", "x", "http://", "file:///etc/passwd", "metadata.google.internal"]) expect(siteHost(bad), bad).toBeNull();
    expect(siteHost(" https://www.MotherMoon.co.za/shop?x=1 ")).toBe("www.mothermoon.co.za");
    const { fetchSite } = await import("@/brand/fetch-site.ts");
    expect(await fetchSite("169.254.169.254")).toEqual({ ok: false, code: "bad_address" });
    const src = readFileSync(path.join(ROOT, "src/brand/fetch-site.ts"), "utf8");
    // One fetch, never following a redirect on its own, on a clock, with no cookie, key or body of ours.
    expect(src.match(/\bfetch\(/g)!.length).toBe(1);
    expect(src).toMatch(/redirect: "manual"/);
    expect(src).toMatch(/AbortSignal\.timeout\(/);
    expect(src).toMatch(/u\.protocol !== "https:" \|\| u\.port \|\| u\.username \|\| !\(await publicHost\(u\.hostname\)\)/);
    expect(src).not.toMatch(/process\.env|authorization|cookie|method:|body:/i);
    // Only the Portal's brand page reads a website.
    const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
    expect([...walk("src"), ...walk("app")].filter((f) => /fetchSite\(/.test(readFileSync(path.join(ROOT, f), "utf8"))).sort()).toEqual([path.join("app", "portal", "brand", "page.tsx"), path.join("src", "brand", "fetch-site.ts")]);
  });
});

describe("the mockup shop a client can open", () => {
  const NOW = new Date("2026-11-21T11:00:00Z");
  const file = mockOrders(() => NOW);
  const quotes = mockBook(() => NOW);
  const noop = async () => {};
  const STAFF_WORDS = /\b(margin|mark-?up|supplier|stock|cost|costs|costing|print house)\b/i;

  test("the shop is clean for every client, as data and as HTML, and names no product code", async () => {
    const clients = [...new Set(mockOrderList(NOW).map((o) => o.client.id)), "c_sandton"];
    let seen = 0;
    for (const client of clients) {
      for (const filter of ["all", "ordered"] as const) {
        const view = await portalShop(quotes, file, client, filter);
        if (!view) continue;
        const page = renderToStaticMarkup(createElement(ShopScreen, { view, said: null, again: noop }));
        expect(leaksIn(view), client).toEqual([]);
        expect(leaksInText(page), client).toEqual([]);
        expect(page.match(STAFF_WORDS)?.[0] ?? null, client).toBeNull();
        expect(page).not.toMatch(/NEL-[A-Z]{3}-/);
        seen += view.items.length;
      }
    }
    expect(seen).toBeGreaterThan(12);
  });

  test("a shop holds the client's own sent and ordered pieces: never a draft, never another client's", async () => {
    const mine = await quotes.forClient(MOCK_PORTAL_CLIENT_ID);
    const own = new Set([...mine.filter((q) => q.versions.length > 0).flatMap((q) => q.versions.at(-1)!.lines.map((l) => l.product_name)), ...(await file.forClient(MOCK_PORTAL_CLIENT_ID)).flatMap((o) => o.lines.map((l) => l.product_name))]);
    const shop = (await portalShop(quotes, file, MOCK_PORTAL_CLIENT_ID, "all"))!;
    expect(shop.items.length).toBeGreaterThanOrEqual(12);
    for (const item of shop.items) expect(own.has(item.name), item.name).toBe(true);
    for (const item of shop.items) expect(item.from_href).toMatch(/^\/(quotes\/Q-\d{5}|orders\/N-\d{4})$/);
    expect(await portalShop(quotes, file, "c_nobody", "all")).toBeNull();
    // A book that hands over everyone's quotes and orders still yields only this client's pieces.
    const all = await quotes.all();
    const crossed = await shopItems({ ...quotes, forClient: async () => all }, { ...file, forClient: async () => mockOrderList(NOW) }, MOCK_PORTAL_CLIENT_ID);
    expect(crossed.items.map((i) => i.id).sort()).toEqual(shop.items.map((i) => i.id).sort());
  });

  test("a guide price is one Nelson quoted, at the quantity he quoted it for; ordering again opens a quote and prices nothing", () => {
    const view = readFileSync(path.join(ROOT, "src/portal/shop.ts"), "utf8");
    expect(view).not.toMatch(/Math\.(round|ceil|floor)\([^)]*cents|multipl|mark-?up|cents\s*[*\/]|[*\/]\s*\w+\.unit_cents/i);
    const actions = readFileSync(path.join(ROOT, "src/portal/shop-actions.ts"), "utf8");
    const exported = [...actions.matchAll(/export async function (\w+)\(form: FormData\): Promise<void> \{\n\s+const item = await ownItem\(form\);/g)].map((m) => m[1]);
    expect(exported).toEqual(["orderAgain"]);
    expect([...actions.matchAll(/export (?:async function|const) (\w+)/g)].map((m) => m[1])).toEqual(exported);
    expect(actions).toMatch(/shopItems\(quoteBook\(\), orderFile\(\), portalClientId\(\)\)/);
    expect(actions).not.toMatch(/unit_cents|cents/);
  });
});

describe("the settings a client can open", () => {
  const NOW = new Date("2026-11-21T11:00:00Z");
  const file = mockOrders(() => NOW);
  const quotes = mockBook(() => NOW);
  const noop = async () => {};

  test("settings are clean for every client and show their own company only", async () => {
    const clients = [...new Set(mockOrderList(NOW).map((o) => o.client))];
    for (const client of clients) {
      const view = (await portalSettings(quotes, file, client.id, true))!;
      const page = renderToStaticMarkup(createElement(SettingsScreen, { view, said: null, save: noop }));
      expect(leaksIn(view), client.id).toEqual([]);
      expect(leaksInText(page), client.id).toEqual([]);
      expect(page.match(/\b(margin|mark-?up|supplier|stock|cost|costs|costing|print house|VAT)\b/i)?.[0] ?? null, client.id).toBeNull();
      for (const other of clients.filter((c) => c.id !== client.id)) expect(page, `${client.id} sees ${other.id}`).not.toContain(other.name);
    }
    expect(await portalSettings(quotes, file, "c_nobody", true)).toBeNull();
    // A book that hands over everyone's still yields this client's company.
    const all = await quotes.all();
    expect((await portalSettings({ ...quotes, forClient: async () => all }, file, MOCK_PORTAL_CLIENT_ID, true))!.client_name).toBe("Mother Moon Herbals");
  });

  test("only an Owner saves settings, order updates cannot be switched off, and the page prints no address of ours or key", () => {
    const actions = readFileSync(path.join(ROOT, "src/portal/settings-actions.ts"), "utf8");
    expect(actions).toMatch(/export async function saveUpdates\(form: FormData\): Promise<void> \{\n\s+if \(portalRole\(\) !== "owner"\) return redirect/);
    expect([...actions.matchAll(/export (?:async function|const) (\w+)/g)].map((m) => m[1])).toEqual(["saveUpdates"]);
    expect(actions).toMatch(/k !== "orders"/);
    const viewer = renderToStaticMarkup(createElement(SettingsScreen, { view: { client_name: "A", may_change: false, company: [], updates: [{ kind: "quotes", title: "Quotes", sub: "", email: true, whatsapp: true, locked: false }], team: [] }, said: null, save: noop }));
    expect(viewer).not.toMatch(/>Save</);
    expect(viewer.match(/disabled/g)!.length).toBe(2);
    // The Desk's settings report whether a thing is set, never its value.
    const desk = readFileSync(path.join(ROOT, "src/desk/settings.ts"), "utf8");
    expect(desk).not.toMatch(/env\.[A-Z_]+|process\.env\.[A-Z]/);
  });
});
