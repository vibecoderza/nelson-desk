// Writes prisma/migrations/0002_walls/migration.sql: the portal schema's views, the desk_portal role and the
// trigger that freezes a sent quote version. Run with `npm run db:walls` after `npm run db:sql`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PORTAL_ROLE, PORTAL_SCHEMA, PORTAL_VIEWS } from "../src/portal/views.ts";

const root = path.resolve(import.meta.dirname, "..");

// Column names per table, read from the init migration.
export function tableColumns(initSql: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  for (const m of initSql.matchAll(/CREATE TABLE "([a-z_]+)" \(\n([\s\S]*?)\n\);/g)) {
    tables.set(m[1]!, [...m[2]!.matchAll(/^\s+"([a-z0-9_]+)" /gm)].map((c) => c[1]!));
  }
  return tables;
}

export function wallsSql(initSql: string): string {
  const tables = tableColumns(initSql);
  const out: string[] = [
    "-- Written by scripts/build-walls.ts from src/portal/views.ts. Do not edit by hand.",
    "-- The second wall behind the hostname split (brief 7.4): Portal code connects as a member of desk_portal,",
    "-- which can read these views and nothing else.",
    "",
    `CREATE SCHEMA IF NOT EXISTS "${PORTAL_SCHEMA}";`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PORTAL_ROLE}') THEN CREATE ROLE ${PORTAL_ROLE} NOLOGIN; END IF; END $$;`,
    `REVOKE ALL ON SCHEMA public FROM ${PORTAL_ROLE};`,
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${PORTAL_ROLE};`,
    `GRANT USAGE ON SCHEMA "${PORTAL_SCHEMA}" TO ${PORTAL_ROLE};`,
    "",
  ];
  for (const [table, view] of Object.entries(PORTAL_VIEWS)) {
    const columns = tables.get(table);
    if (!columns) throw new Error(`portal view for a table that does not exist: ${table}`);
    for (const c of view.except ?? []) if (!columns.includes(c)) throw new Error(`${table}.${c} is not a column`);
    const shown = columns.filter((c) => !(view.except ?? []).includes(c));
    out.push(`CREATE VIEW "${PORTAL_SCHEMA}"."${table}" AS SELECT ${shown.map((c) => `"${c}"`).join(", ")} FROM public."${table}"${view.where ? ` WHERE ${view.where}` : ""};`);
    out.push(`GRANT SELECT ON "${PORTAL_SCHEMA}"."${table}" TO ${PORTAL_ROLE};`);
  }
  out.push(
    "",
    "-- A quote version is immutable once sent (brief 3.2): its lines, prices, mockups, terms and total are frozen.",
    "-- Only the document keys made from it (the PDF, the mockup snapshot) may be filled in afterwards.",
    `CREATE FUNCTION quote_version_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sent_at IS NOT NULL THEN RAISE EXCEPTION 'quote version % v% is sent and cannot be deleted', OLD.quote_id, OLD.version; END IF;
    RETURN OLD;
  END IF;
  IF OLD.sent_at IS NOT NULL AND (
    NEW.sent_at IS DISTINCT FROM OLD.sent_at OR NEW.quote_id IS DISTINCT FROM OLD.quote_id OR NEW.version IS DISTINCT FROM OLD.version OR
    NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.price_customer IS DISTINCT FROM OLD.price_customer OR
    NEW.price_version IS DISTINCT FROM OLD.price_version OR NEW.total_cents IS DISTINCT FROM OLD.total_cents OR
    NEW.change_log IS DISTINCT FROM OLD.change_log
  ) THEN RAISE EXCEPTION 'quote version % v% is sent and frozen', OLD.quote_id, OLD.version; END IF;
  RETURN NEW;
END $$;`,
    "CREATE TRIGGER quote_version_frozen BEFORE UPDATE OR DELETE ON quote_version FOR EACH ROW EXECUTE FUNCTION quote_version_frozen();",
    "",
    "-- The event log is the record every screen reads. Rows are never deleted.",
    `CREATE FUNCTION event_never_deleted() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'events are never deleted'; END $$;`,
    "CREATE TRIGGER event_never_deleted BEFORE DELETE ON event FOR EACH ROW EXECUTE FUNCTION event_never_deleted();",
    "",
  );
  return out.join("\n");
}

export const INIT_SQL = path.join(root, "prisma/migrations/0001_init/migration.sql");
export const WALLS_SQL = path.join(root, "prisma/migrations/0002_walls/migration.sql");

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  mkdirSync(path.dirname(WALLS_SQL), { recursive: true });
  writeFileSync(WALLS_SQL, wallsSql(readFileSync(INIT_SQL, "utf8")));
  console.log(`wrote ${path.relative(root, WALLS_SQL)}`);
}
