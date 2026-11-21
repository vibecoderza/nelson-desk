// Two hosts, two sessions, two route trees (brief 7.2). This module decides, for every request, which surface it
// belongs to and whether it may pass. It is pure: the proxy feeds it the host, the path and the session facts.
//
// Default deny. A path is closed unless it is listed here or the session passes the surface's rule.

export type Surface = "desk" | "portal";

export type Hosts = { desk: string[]; portal: string[] };
export const DEV_HOSTS: Hosts = { desk: ["desk.localhost"], portal: ["my.localhost"] };

export function surfaceForHost(hostHeader: string | null | undefined, hosts: Hosts): Surface | null {
  const host = (hostHeader ?? "").toLowerCase().replace(/:\d+$/, "");
  if (hosts.desk.includes(host)) return "desk";
  if (hosts.portal.includes(host)) return "portal";
  return null; // previews and unknown hosts serve nothing (Vercel's own login guards previews as well)
}

// What the proxy learned from the session. Null means signed out.
export type Session = {
  userId: string;
  email: string | null; // from the session token's `email` claim
  secondFactorVerified: boolean;
  actingForSomeoneElse: boolean; // an actor or agent token. Off until agent sessions are restricted (brief 3.8)
  orgId: string | null; // Portal: the client
  orgRole: string | null; // Portal: org:owner | org:buyer | org:viewer
} | null;

// Pages anyone may open, per surface. The Desk has exactly one: its sign-in.
export const PUBLIC_PAGES: Record<Surface, readonly string[]> = { desk: ["/sign-in"], portal: ["/sign-in"] };

// Machine routes: no session, each guarded by its own credential inside the route.
export const MACHINE_ROUTES: Record<Surface, Readonly<Record<string, string>>> = {
  desk: {
    "/api/v1/webhooks/nelson": "HMAC signature, DESK_WEBHOOK_SECRET",
    "/api/cron/outbox": "Bearer CRON_SECRET",
    "/api/health": "none: answers ok and nothing else",
  },
  // /api/v1/brand-kit (studio token, PORTAL_TOKEN_SIGNING_KEY) joins this list in the card that builds the route.
  portal: {
    "/api/health": "none: answers ok and nothing else",
  },
};

export type Decision =
  | { action: "not_found" }
  | { action: "machine"; path: string } // passes without a session; the route checks its own credential
  | { action: "page"; rewriteTo: string } // passes; served from the surface's own tree
  | { action: "sign_in" }
  | { action: "refuse"; reason: "not_on_the_staff_list" | "second_factor_required" | "delegated_session" };

const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

export function decide(surface: Surface, pathname: string, session: Session, staffEmails: readonly string[]): Decision {
  // The internal trees are never addressable from outside: /desk/... on the portal host is not a way in.
  if (under(pathname, "/desk") || under(pathname, "/portal")) return { action: "not_found" };

  if (under(pathname, "/api")) {
    if (pathname in MACHINE_ROUTES[surface]) return { action: "machine", path: pathname };
    // A machine route belongs to one host. The other host does not serve it, signed in or not.
    const other: Surface = surface === "desk" ? "portal" : "desk";
    if (pathname in MACHINE_ROUTES[other]) return { action: "not_found" };
    if (!session) return { action: "not_found" };
    const refused = sessionRule(surface, session, staffEmails);
    return refused ?? { action: "page", rewriteTo: pathname };
  }

  const rewriteTo = `/${surface}${pathname === "/" ? "" : pathname}`;
  if (PUBLIC_PAGES[surface].some((p) => under(pathname, p))) return { action: "page", rewriteTo };
  if (!session) return { action: "sign_in" };
  return sessionRule(surface, session, staffEmails) ?? { action: "page", rewriteTo };
}

function sessionRule(surface: Surface, session: NonNullable<Session>, staffEmails: readonly string[]): Decision | null {
  if (session.actingForSomeoneElse) return { action: "refuse", reason: "delegated_session" };
  if (surface === "desk") {
    // Staff sign in from an allow-list and with a second factor, because the Desk shows cost (brief 7.6).
    const email = session.email?.trim().toLowerCase();
    if (!email || !staffEmails.map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email)) return { action: "refuse", reason: "not_on_the_staff_list" };
    if (!session.secondFactorVerified) return { action: "refuse", reason: "second_factor_required" };
  }
  return null;
}

// Headers every response carries. Nothing either surface serves behind a login is cacheable.
export function responseHeaders(surface: Surface, decision: Decision): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Robots-Tag": "noindex, nofollow",
  };
  // The Desk shows cost: private, no-store on everything it sends. The Portal is per client, so the same holds.
  if (surface === "desk" || decision.action !== "machine") headers["Cache-Control"] = "private, no-store";
  return headers;
}
