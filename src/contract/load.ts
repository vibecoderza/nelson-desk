// Loads the contract from disk: the OpenAPI file, its JSON Schemas and its fixtures. Used by the mock server and the
// contract tests, never by a page.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";

export const CONTRACT_DIR = path.resolve(import.meta.dirname, "..", "..", "contract");
export const SCHEMA_BASE = "https://contract.dearnelson.co.za/v1/";

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

export function loadSchemas(): { ajv: Ajv2020; names: string[] } {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  (addFormats as unknown as (a: Ajv2020) => void)(ajv);
  const dir = path.join(CONTRACT_DIR, "schemas");
  const names = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  for (const name of names) ajv.addSchema(readJson(path.join(dir, name)) as object);
  return { ajv, names };
}

export function validator(ajv: Ajv2020, schemaFile: string): ValidateFunction {
  const validate = ajv.getSchema(SCHEMA_BASE + schemaFile);
  if (!validate) throw new Error(`no schema ${schemaFile}`);
  return validate;
}

export const fixture = <T = unknown>(name: string): T => readJson(path.join(CONTRACT_DIR, "fixtures", name)) as T;

export type FixtureIndex = { fixtures: Record<string, string>; portal_safe: string[] };
export const fixtureIndex = (): FixtureIndex => fixture<FixtureIndex>("index.json");

export type OpenApi = {
  openapi: string;
  paths: Record<string, Record<string, { operationId?: string; tags?: string[]; requestBody?: unknown; responses?: Record<string, unknown>; parameters?: unknown[]; security?: unknown[] }>>;
  components: Record<string, Record<string, unknown>>;
};
export const loadOpenApi = (): OpenApi => parse(readFileSync(path.join(CONTRACT_DIR, "openapi.yaml"), "utf8")) as OpenApi;

// Every "./schemas/x.json" or "./schemas/x.json#/..." the OpenAPI file points at.
export function schemaRefs(doc: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(doc)) for (const v of doc) schemaRefs(v, found);
  else if (doc && typeof doc === "object") {
    for (const [k, v] of Object.entries(doc)) {
      if (k === "$ref" && typeof v === "string" && v.startsWith("./schemas/")) found.add(v.slice("./schemas/".length));
      else schemaRefs(v, found);
    }
  }
  return found;
}
