// Two connections, two walls. The Desk connects as the owner; the Portal connects as a member of desk_portal with
// the portal schema, so the same models read the views and the staff tables do not exist for it.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

let desk: PrismaClient | undefined;
let portal: PrismaClient | undefined;

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

export const deskDb = (): PrismaClient => (desk ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: need("DATABASE_URL") }) }));

export const portalDb = (): PrismaClient =>
  (portal ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: need("DATABASE_URL_PORTAL") }, { schema: "portal" }) }));
