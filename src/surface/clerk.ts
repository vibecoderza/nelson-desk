// Clerk, two applications: one for the Desk, one for the Portal. Two applications give two sessions, two cookie
// scopes and separate rules (staff allow-list and forced second factor on the Desk; Google, email link and
// Organisations for client roles on the Portal). Keys are read from the environment by name; values live in Vercel.
import type { Session, Surface } from "./access.ts";

export type ClerkKeys = { publishableKey: string; secretKey: string };

export function clerkKeys(surface: Surface, env: Record<string, string | undefined> = process.env): ClerkKeys | null {
  const prefix = surface === "desk" ? "CLERK_DESK" : "CLERK_PORTAL";
  const publishableKey = env[`${prefix}_PUBLISHABLE_KEY`];
  const secretKey = env[`${prefix}_SECRET_KEY`];
  return publishableKey && secretKey ? { publishableKey, secretKey } : null;
}

type Claims = Record<string, unknown> | null | undefined;

// Session facts from Clerk's auth object. `fva` is [minutes since first factor, minutes since second factor];
// -1 means that factor was never verified in this session. `act` marks a session acting for someone else.
export function sessionFrom(auth: { userId: string | null; sessionClaims?: Claims; orgId?: string | null; orgRole?: string | null }): Session {
  if (!auth.userId) return null;
  const claims = auth.sessionClaims ?? {};
  const fva = claims.fva;
  return {
    userId: auth.userId,
    email: typeof claims.email === "string" ? claims.email : null,
    secondFactorVerified: Array.isArray(fva) && typeof fva[1] === "number" && fva[1] >= 0,
    actingForSomeoneElse: claims.act != null || claims.agent != null,
    orgId: auth.orgId ?? null,
    orgRole: auth.orgRole ?? null,
  };
}

// Clerk Organisation roles on the Portal application map to the brief's client roles (3.6).
export function clientRoleFromOrgRole(orgRole: string | null): "owner" | "buyer" | "viewer" | null {
  switch (orgRole) {
    case "org:owner":
    case "org:admin":
      return "owner";
    case "org:buyer":
      return "buyer";
    case "org:viewer":
    case "org:member":
      return "viewer"; // the least a member can be, until someone gives them more
    default:
      return null;
  }
}

export const hostsFromEnv = (env: Record<string, string | undefined> = process.env) => ({
  desk: [env.DESK_HOST ?? "desk.dearnelson.co.za", ...(env.NODE_ENV === "production" ? [] : ["desk.localhost"])],
  portal: [env.PORTAL_HOST ?? "my.dearnelson.co.za", ...(env.NODE_ENV === "production" ? [] : ["my.localhost"])],
});

export const staffEmailsFromEnv = (env: Record<string, string | undefined> = process.env): string[] => (env.DESK_STAFF_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
