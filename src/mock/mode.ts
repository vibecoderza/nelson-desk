// Mock mode: the Desk and the Portal read a stand-in quote book and a stand-in Nelson, because neither the
// database nor Nelson's endpoints exist yet. It ends by itself: the moment a database or Nelson's address is
// configured, nothing here answers and the real thing is asked instead.
type Env = Record<string, string | undefined>;

export const databaseConfigured = (env: Env = process.env): boolean => Boolean(env.DATABASE_URL || env.DATABASE_URL_PORTAL);
export const mockBookInUse = (env: Env = process.env): boolean => !databaseConfigured(env);
export const mockNelsonInUse = (env: Env = process.env): boolean => !env.NELSON_BASE_URL && !databaseConfigured(env);

export class NotBuiltYet extends Error {
  constructor(what: string) { super(`${what} is not built yet: it lands with the database card`); }
}
