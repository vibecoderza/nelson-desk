// A real Postgres in the test process (PGlite), with both migrations applied. No Neon, no network.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@/generated/prisma/client.ts";
import { INIT_SQL, WALLS_SQL } from "../../scripts/build-walls.ts";

export async function testDb(): Promise<{ pg: PGlite; db: PrismaClient }> {
  const pg = new PGlite();
  await pg.exec(readFileSync(INIT_SQL, "utf8"));
  await pg.exec(readFileSync(WALLS_SQL, "utf8"));
  const db = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  return { pg, db };
}

export async function seedQuote(db: PrismaClient, over: { state?: "working" | "final" | "draft"; lineStates?: ("agreed" | "waiting_on_nelson")[]; validUntil?: Date } = {}) {
  await db.client.create({ data: { id: "c_mothermoon", name: "Mother Moon Herbals" } });
  await db.quote.create({ data: { id: "q_1", ref: "Q-00007", client_id: "c_mothermoon", state: over.state ?? "final", version: 3, valid_until: over.validUntil ?? new Date("2026-12-03T21:59:59Z") } });
  let position = 0;
  for (const state of over.lineStates ?? ["agreed", "agreed"]) {
    position += 1;
    await db.quoteLine.create({ data: { id: `ql_${position}`, quote_id: "q_1", position, product_code: "NEL-CAP-6P", product_name: "6 Panel Cap", colour: "forest", quantity: 100, state, unit_cents: 9500, setup_cents: 35000, line_total_cents: 950000 } });
    await db.quoteLineStaff.create({ data: { id: `qls_${position}`, quote_line_id: `ql_${position}`, supplier: "Amrod", supplier_code: "BH-0042", unit_cost_cents: 3900, branding_cost_cents: 2311, margin_cents: 328900, margin_pct: 34.6 } });
  }
}
