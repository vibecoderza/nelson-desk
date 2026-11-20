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
