// Preview look. A Vercel preview deployment has no Clerk session to offer: both Clerk applications are tied to
// dearnelson.co.za. So that a pull request can be looked at before it merges, a preview serves the two surfaces on
// its own two addresses, behind Vercel's login, while there is nothing real to show.
//
// It answers only when all of these hold:
//   - Vercel says this deployment is a preview (VERCEL_ENV is set by Vercel, never by us);
//   - no database is configured and Nelson has no address, so every screen is sample data;
//   - the request came in on one of this deployment's own two addresses.
// The live hosts never pass the first test. A preview with real data never passes the second.
import { databaseConfigured } from "../mock/mode.ts";
import { MACHINE_ROUTES, type Decision, type Surface } from "./access.ts";

type Env = Record<string, string | undefined>;

export const previewLook = (env: Env = process.env): boolean => env.VERCEL_ENV === "preview" && !databaseConfigured(env) && !env.NELSON_BASE_URL;

const clean = (host: string | null | undefined) => (host ?? "").toLowerCase().replace(/:\d+$/, "");

// The branch address shows the Desk. The deployment's own address shows the Portal.
export function previewSurface(hostHeader: string | null | undefined, env: Env = process.env): Surface | null {
  if (!previewLook(env)) return null;
  const host = clean(hostHeader);
  const desk = clean(env.VERCEL_BRANCH_URL);
  const portal = clean(env.VERCEL_URL);
  if (!host || !desk || !portal || desk === portal) return null;
  if (host === desk) return "desk";
  if (host === portal) return "portal";
  return null;
}

const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

// The same shape of answer as the real front door, with Vercel's login standing in for the session.
export function previewDecide(surface: Surface, pathname: string): Decision {
  if (under(pathname, "/desk") || under(pathname, "/portal")) return { action: "not_found" };
  if (under(pathname, "/api")) return pathname in MACHINE_ROUTES[surface] ? { action: "machine", path: pathname } : { action: "not_found" };
  if (under(pathname, "/sign-in")) return { action: "not_found" };
  return { action: "page", rewriteTo: `/${surface}${pathname === "/" ? "" : pathname}` };
}
