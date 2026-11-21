// Nothing exposed, Desk side (North Star 3.10, brief 7.2 and 7.6).
// The Desk shows cost, supplier and margin, so the question here is who can reach it at all: which host, which
// session, which paths pass without one, and what every response says about caching.
//
// Every new public surface gets a check here. Never weaken these checks to make a build pass.
import { describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { decide, DEV_HOSTS, MACHINE_ROUTES, PUBLIC_PAGES, responseHeaders, surfaceForHost, type Decision, type Session } from "@/surface/access.ts";
import { clerkKeys, clientRoleFromOrgRole, hostsFromEnv, secondFactorRequiredFromEnv, sessionFrom, staffEmailsFromEnv } from "@/surface/clerk.ts";
import { sign, verify } from "@/events/signing.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");
const filesUnder = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).flatMap((n) => { const f = path.join(dir, n); return statSync(f).isDirectory() ? filesUnder(f) : [f]; }) : []);

const STAFF = ["alan@example.test"];
const staff: NonNullable<Session> = { userId: "user_staff", email: "alan@example.test", secondFactorVerified: true, actingForSomeoneElse: false, orgId: null, orgRole: null };
const client: NonNullable<Session> = { userId: "user_client", email: "naledi@example.test", secondFactorVerified: false, actingForSomeoneElse: false, orgId: "org_mm", orgRole: "org:owner" };
const HOSTS = hostsFromEnv({ NODE_ENV: "production" });

// Paths a stranger might try. None of them is a way in.
const PROBES = ["/", "/today", "/quotes", "/quotes/Q-00007", "/orders", "/clients", "/suppliers", "/settings", "/api/quotes", "/api/v1/price", "/api/v1/quotes/Q-00007/staff", "/api/trpc/x", "/api/graphql", "/.env", "/.git/config", "/robots.txt", "/sitemap.xml", "/sign-up", "/admin", "/desk", "/desk/quotes", "/portal", "/portal/quotes", "/_next/data/x.json", "/sign-in.map", "/main.js.map"];

describe("the host decides the surface", () => {
  test("only the two live hosts serve anything; previews and strangers get nothing", () => {
    expect(HOSTS).toEqual({ desk: ["desk.dearnelson.co.za"], portal: ["my.dearnelson.co.za"] });
    expect(surfaceForHost("desk.dearnelson.co.za", HOSTS)).toBe("desk");
    expect(surfaceForHost("DESK.dearnelson.co.za:443", HOSTS)).toBe("desk");
    expect(surfaceForHost("my.dearnelson.co.za", HOSTS)).toBe("portal");
    for (const host of [null, undefined, "", "dearnelson.co.za", "www.dearnelson.co.za", "nelson-desk.vercel.app", "nelson-desk-git-main-x.vercel.app", "desk.dearnelson.co.za.evil.test", "evil.test/desk.dearnelson.co.za", "desk.localhost", "my.localhost", "localhost", "127.0.0.1"]) {
      expect(surfaceForHost(host, HOSTS), String(host)).toBeNull();
    }
  });

  test("the local hosts exist outside production only", () => {
    expect(hostsFromEnv({ NODE_ENV: "development" }).desk).toContain(DEV_HOSTS.desk[0]);
    expect(hostsFromEnv({ NODE_ENV: "production" }).desk).not.toContain(DEV_HOSTS.desk[0]);
    expect(hostsFromEnv({ NODE_ENV: "production" }).portal).not.toContain(DEV_HOSTS.portal[0]);
  });

  test("the proxy answers an unknown host before anything else and covers every path", () => {
    const src = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");
    const body = src.slice(src.indexOf("export default function proxy"));
    expect(body.indexOf("if (!surface) return plain(404")).toBeGreaterThan(0);
    expect(body.indexOf("if (!surface) return plain(404")).toBeLessThan(body.indexOf("decide("));
    expect(src).toMatch(/matcher: \["\/\(\(\?!_next\/static\|_next\/image\|favicon\.ico\)\.\*\)"\]/);
    expect(existsSync(path.join(ROOT, "middleware.ts"))).toBe(false); // one front door, not two
  });
});

describe("the Desk has no public routes", () => {
  test("signed out, a stranger reaches the sign-in page and nothing else", () => {
    expect(PUBLIC_PAGES.desk).toEqual(["/sign-in"]);
    expect(decide("desk", "/sign-in", null, STAFF)).toEqual({ action: "page", rewriteTo: "/desk/sign-in" });
    for (const p of PROBES) {
      const d = decide("desk", p, null, STAFF);
      expect(["sign_in", "not_found"], `${p} -> ${d.action}`).toContain(d.action);
    }
    // An API path never redirects: signed out it does not exist.
    for (const p of PROBES.filter((p) => p.startsWith("/api"))) expect(decide("desk", p, null, STAFF).action, p).toBe("not_found");
  });

  test("the only paths that pass without a session are the listed machine routes, each with its own lock", () => {
    expect(Object.keys(MACHINE_ROUTES.desk).sort()).toEqual(["/api/cron/outbox", "/api/health", "/api/v1/webhooks/nelson"]);
    expect(Object.keys(MACHINE_ROUTES.portal).sort()).toEqual(["/api/health"]);
    for (const p of Object.keys(MACHINE_ROUTES.desk)) expect(decide("desk", p, null, STAFF)).toEqual({ action: "machine", path: p });
    // Exact match only.
    for (const p of ["/api/health/", "/api/health/x", "/api/v1/webhooks", "/api/v1/webhooks/nelson/x", "/api/cron", "/api/cron/outbox2"]) {
      expect(decide("desk", p, null, STAFF).action, p).toBe("not_found");
    }
  });

  test("the machine route list is the route files, no more and no fewer", () => {
    const routes = filesUnder(path.join(ROOT, "app")).map(rel).filter((f) => /\/route\.tsx?$/.test(f));
    expect(routes.every((f) => f.startsWith("app/api/")), "a route file outside app/api").toBe(true);
    const paths = routes.map((f) => "/" + f.replace(/^app\//, "").replace(/\/route\.tsx?$/, "")).sort();
    const listed = [...new Set([...Object.keys(MACHINE_ROUTES.desk), ...Object.keys(MACHINE_ROUTES.portal)])].sort();
    expect(paths).toEqual(listed);
  });

  test("each machine route checks its credential before it does anything, and fails closed", () => {
    const webhook = readFileSync(path.join(ROOT, "app/api/v1/webhooks/nelson/route.ts"), "utf8");
    expect(webhook).toMatch(/DESK_WEBHOOK_SECRET/);
    expect(webhook).toMatch(/receiveNelsonEvent/);
    const inbox = readFileSync(path.join(ROOT, "src/backbone/inbox.ts"), "utf8");
    const receive = inbox.slice(inbox.indexOf("export async function receiveNelsonEvent"));
    expect(receive.indexOf("verify(")).toBeGreaterThan(0);
    expect(receive.indexOf("verify(")).toBeLessThan(receive.search(/parseNelsonEvent\(|db\b(?!:)/));

    const cron = readFileSync(path.join(ROOT, "app/api/cron/outbox/route.ts"), "utf8");
    expect(cron).toMatch(/CRON_SECRET/);
    expect(cron.search(/CRON_SECRET/)).toBeLessThan(cron.search(/drain\(/));

    const health = readFileSync(path.join(ROOT, "app/api/health/route.ts"), "utf8");
    expect(health).not.toMatch(/process\.env|deskDb|portalDb|import /);

    // The signature itself: wrong secret, empty secret, stale timestamp and a changed body all fail.
    const now = new Date(1_800_000_000_000);
    const later = new Date(now.getTime() + 301_000);
    const body = '{"id":"evt_1"}';
    const header = sign(body, "s3cret-for-this-test", now);
    expect(verify(body, header, "s3cret-for-this-test", now).ok).toBe(true);
    expect(verify(body, header, "another", now).ok).toBe(false);
    expect(verify(body, header, "", now).ok).toBe(false);
    expect(verify(body + " ", header, "s3cret-for-this-test", now).ok).toBe(false);
    expect(verify(body, header, "s3cret-for-this-test", later).ok).toBe(false);
    expect(verify(body, "", "s3cret-for-this-test", now).ok).toBe(false);
  });

  test("a machine route belongs to one host", () => {
    for (const p of ["/api/v1/webhooks/nelson", "/api/cron/outbox"]) {
      expect(decide("portal", p, null, STAFF).action, p).toBe("not_found");
      expect(decide("portal", p, client, STAFF).action, `${p} signed in`).toBe("not_found");
    }
  });

  test("the internal trees cannot be addressed from outside, on either host, signed in or not", () => {
    for (const surface of ["desk", "portal"] as const) for (const session of [null, staff, client]) for (const p of ["/desk", "/desk/", "/desk/quotes", "/desk/sign-in", "/portal", "/portal/quotes", "/portal/sign-in"]) {
      expect(decide(surface, p, session, STAFF), `${surface} ${p}`).toEqual({ action: "not_found" });
    }
    // Look-alikes are ordinary paths, not the tree.
    expect(decide("desk", "/desktop", staff, STAFF)).toEqual({ action: "page", rewriteTo: "/desk/desktop" });
  });
});

describe("who may open the Desk", () => {
  test("staff on the list with a second factor, and nobody else", () => {
    expect(decide("desk", "/", staff, STAFF)).toEqual({ action: "page", rewriteTo: "/desk" });
    expect(decide("desk", "/quotes/Q-00007", staff, STAFF)).toEqual({ action: "page", rewriteTo: "/desk/quotes/Q-00007" });
    expect(decide("desk", "/", { ...staff, email: " Alan@Example.TEST " }, STAFF).action).toBe("page");

    const refused = (s: Session, list = STAFF) => decide("desk", "/quotes", s, list);
    expect(refused({ ...staff, secondFactorVerified: false })).toEqual({ action: "refuse", reason: "second_factor_required" });
    expect(refused({ ...staff, email: "someone@example.test" })).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(refused({ ...staff, email: null })).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(refused({ ...staff, email: "" })).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(refused({ ...staff, email: "alan@example.test.evil.test" })).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    // An empty list lets nobody in. It is never read as "everyone".
    expect(refused(staff, [])).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(refused({ ...staff, email: "" }, [""])).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    // A client's session, however senior, is not a staff session.
    expect(refused(client)).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(decide("desk", "/api/quotes", client, STAFF)).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
  });

  test("the second factor can be skipped only while the Desk has no database, and only by the exact switch", () => {
    const noFactor = { ...staff, secondFactorVerified: false };
    // decide() requires it unless told otherwise.
    expect(decide("desk", "/", noFactor, STAFF)).toEqual({ action: "refuse", reason: "second_factor_required" });
    expect(decide("desk", "/", noFactor, STAFF, false)).toEqual({ action: "page", rewriteTo: "/desk" });
    // Skipping it never skips the allow-list or the delegated-session refusal.
    expect(decide("desk", "/", { ...noFactor, email: "someone@example.test" }, STAFF, false)).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(decide("desk", "/", { ...client }, STAFF, false)).toEqual({ action: "refuse", reason: "not_on_the_staff_list" });
    expect(decide("desk", "/", { ...noFactor, actingForSomeoneElse: true }, STAFF, false)).toEqual({ action: "refuse", reason: "delegated_session" });

    expect(secondFactorRequiredFromEnv({})).toBe(true);
    expect(secondFactorRequiredFromEnv({ DESK_SECOND_FACTOR: "off" })).toBe(false);
    for (const v of ["OFF", "false", "0", "no", " off", ""]) expect(secondFactorRequiredFromEnv({ DESK_SECOND_FACTOR: v }), v).toBe(true);
    // The moment real data is wired, the switch stops working.
    expect(secondFactorRequiredFromEnv({ DESK_SECOND_FACTOR: "off", DATABASE_URL: "set" })).toBe(true);
    expect(secondFactorRequiredFromEnv({ DESK_SECOND_FACTOR: "off", DATABASE_URL_PORTAL: "set" })).toBe(true);

    const src = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");
    expect(src).toMatch(/staffEmailsFromEnv\(\), secondFactorRequiredFromEnv\(\)\)/);
  });

  test("a session acting for someone else is refused on both surfaces until agent sessions are restricted", () => {
    expect(decide("desk", "/", { ...staff, actingForSomeoneElse: true }, STAFF)).toEqual({ action: "refuse", reason: "delegated_session" });
    expect(decide("desk", "/api/quotes", { ...staff, actingForSomeoneElse: true }, STAFF)).toEqual({ action: "refuse", reason: "delegated_session" });
    expect(decide("portal", "/", { ...client, actingForSomeoneElse: true }, STAFF)).toEqual({ action: "refuse", reason: "delegated_session" });
  });

  test("session facts come from the token and default to the safe side", () => {
    expect(sessionFrom({ userId: null })).toBeNull();
    const bare = sessionFrom({ userId: "u" })!;
    expect(bare).toMatchObject({ email: null, secondFactorVerified: false, actingForSomeoneElse: false, orgId: null, orgRole: null });
    expect(sessionFrom({ userId: "u", sessionClaims: { fva: [3, -1] } })!.secondFactorVerified).toBe(false);
    expect(sessionFrom({ userId: "u", sessionClaims: { fva: [3, 0] } })!.secondFactorVerified).toBe(true);
    expect(sessionFrom({ userId: "u", sessionClaims: { fva: "3,0" } })!.secondFactorVerified).toBe(false);
    expect(sessionFrom({ userId: "u", sessionClaims: { fva: [3] } })!.secondFactorVerified).toBe(false);
    expect(sessionFrom({ userId: "u", sessionClaims: { act: { sub: "user_x" } } })!.actingForSomeoneElse).toBe(true);
    expect(sessionFrom({ userId: "u", sessionClaims: { agent: true } })!.actingForSomeoneElse).toBe(true);
    expect(sessionFrom({ userId: "u", sessionClaims: { email: ["alan@example.test"] } })!.email).toBeNull();
    expect(staffEmailsFromEnv({})).toEqual([]);
    expect(staffEmailsFromEnv({ DESK_STAFF_EMAILS: " a@x.test, ,b@x.test," })).toEqual(["a@x.test", "b@x.test"]);
  });

  test("the Portal lets a signed-in client in, with the least role a member can have", () => {
    expect(decide("portal", "/", null, STAFF)).toEqual({ action: "sign_in" });
    expect(decide("portal", "/quotes", client, STAFF)).toEqual({ action: "page", rewriteTo: "/portal/quotes" });
    expect(clientRoleFromOrgRole("org:owner")).toBe("owner");
    expect(clientRoleFromOrgRole("org:buyer")).toBe("buyer");
    expect(clientRoleFromOrgRole("org:viewer")).toBe("viewer");
    expect(clientRoleFromOrgRole("org:member")).toBe("viewer");
    for (const r of [null, "", "owner", "org:staff", "org:superuser"]) expect(clientRoleFromOrgRole(r), String(r)).toBeNull();
  });
});

describe("two applications, two sessions", () => {
  test("each surface reads its own keys and never the other's", () => {
    const env = { CLERK_DESK_PUBLISHABLE_KEY: "pk_test_desk", CLERK_DESK_SECRET_KEY: "sk_test_desk", CLERK_PORTAL_PUBLISHABLE_KEY: "pk_test_portal", CLERK_PORTAL_SECRET_KEY: "sk_test_portal" };
    expect(clerkKeys("desk", env)).toEqual({ publishableKey: "pk_test_desk", secretKey: "sk_test_desk" });
    expect(clerkKeys("portal", env)).toEqual({ publishableKey: "pk_test_portal", secretKey: "sk_test_portal" });
    // A malformed or swapped pair is no pair: 503, never Clerk throwing a 500 on every request.
    expect(clerkKeys("portal", { CLERK_PORTAL_PUBLISHABLE_KEY: '"pk_test_portal"', CLERK_PORTAL_SECRET_KEY: "sk_test_portal" })).toBeNull();
    expect(clerkKeys("portal", { CLERK_PORTAL_PUBLISHABLE_KEY: "sk_test_portal", CLERK_PORTAL_SECRET_KEY: "pk_test_portal" })).toBeNull();
    expect(clerkKeys("portal", { CLERK_PORTAL_PUBLISHABLE_KEY: " pk_test_portal", CLERK_PORTAL_SECRET_KEY: "sk_test_portal" })).toBeNull();
    // Half a pair, the other surface's pair, or Clerk's default names: no keys, so no sign-in.
    expect(clerkKeys("desk", { CLERK_DESK_PUBLISHABLE_KEY: "x" })).toBeNull();
    expect(clerkKeys("desk", { CLERK_PORTAL_PUBLISHABLE_KEY: "x", CLERK_PORTAL_SECRET_KEY: "y" })).toBeNull();
    expect(clerkKeys("desk", { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "x", CLERK_SECRET_KEY: "y" })).toBeNull();
    expect(clerkKeys("portal", {})).toBeNull();
  });

  test("without keys the proxy serves nothing behind a login, and no stand-in application is made", () => {
    const src = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");
    const body = src.slice(src.indexOf("export default function proxy"));
    expect(body.indexOf("if (!clerkKeys(surface)) return plain(503")).toBeGreaterThan(0);
    expect(body.indexOf("if (!clerkKeys(surface)) return plain(503")).toBeLessThan(body.indexOf("guarded(req, event)"));
    expect(readFileSync(path.join(ROOT, "next.config.ts"), "utf8")).toMatch(/NEXT_PUBLIC_CLERK_KEYLESS_DISABLED:\s*"true"/);
    // Clerk's default key names are never set here: with them, one application would serve both hosts.
    const env = readFileSync(path.join(ROOT, ".env.example"), "utf8");
    expect(env).not.toMatch(/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=|^CLERK_SECRET_KEY=/m);
    for (const name of ["CLERK_DESK_PUBLISHABLE_KEY", "CLERK_DESK_SECRET_KEY", "CLERK_PORTAL_PUBLISHABLE_KEY", "CLERK_PORTAL_SECRET_KEY", "CLERK_ENCRYPTION_KEY", "DESK_STAFF_EMAILS"]) expect(env).toMatch(new RegExp(`^${name}=$`, "m"));
  });

  test("each tree mounts its own application's key, and there is no sign-up page on the Desk", () => {
    const desk = readFileSync(path.join(ROOT, "app/desk/layout.tsx"), "utf8");
    const portal = readFileSync(path.join(ROOT, "app/portal/layout.tsx"), "utf8");
    expect(desk).toMatch(/publishableKey=\{process\.env\.CLERK_DESK_PUBLISHABLE_KEY\}/);
    expect(desk).not.toMatch(/portal/i);
    expect(portal).toMatch(/publishableKey=\{process\.env\.CLERK_PORTAL_PUBLISHABLE_KEY\}/);
    expect(portal).not.toMatch(/CLERK_DESK/);
    const deskFiles = filesUnder(path.join(ROOT, "app/desk")).map(rel);
    expect(deskFiles.some((f) => /sign-up/.test(f))).toBe(false);
    for (const f of deskFiles) expect(readFileSync(path.join(ROOT, f), "utf8"), f).not.toMatch(/<SignUp|signUpUrl|secretKey|CLERK_\w*SECRET/);
  });
});

describe("what the Desk sends", () => {
  const decisions: Decision[] = [{ action: "not_found" }, { action: "machine", path: "/api/health" }, { action: "page", rewriteTo: "/desk" }, { action: "sign_in" }, { action: "refuse", reason: "not_on_the_staff_list" }, { action: "refuse", reason: "second_factor_required" }, { action: "refuse", reason: "delegated_session" }];

  test("every Desk response is private, no-store, unframeable and unindexed", () => {
    for (const d of decisions) {
      const h = responseHeaders("desk", d);
      expect(h["Cache-Control"], d.action).toBe("private, no-store");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
    }
    for (const d of decisions.filter((d) => d.action !== "machine")) expect(responseHeaders("portal", d)["Cache-Control"], d.action).toBe("private, no-store");
  });

  test("every Desk page is rendered per request on the server", () => {
    const layout = readFileSync(path.join(ROOT, "app/desk/layout.tsx"), "utf8");
    expect(layout).toMatch(/export const dynamic = "force-dynamic"/);
    const files = filesUnder(path.join(ROOT, "app/desk"));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, rel(f)).not.toMatch(/generateStaticParams|force-static|export const revalidate|["']use cache["']/);
      expect(src, rel(f)).not.toMatch(/^\s*["']use client["']/); // staff data is rendered on the server, never shipped as code
    }
  });

  test("the proxy puts the headers on every answer it gives a known host", () => {
    const src = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");
    // Every NextResponse the guarded handler returns goes through withHeaders; plain() carries no-store itself.
    const guarded = src.slice(src.indexOf("const guarded"), src.indexOf("export default function proxy"));
    const returns = guarded.match(/return [^;]+;/g)!.filter((r) => /NextResponse|plain\(/.test(r));
    expect(returns.length).toBeGreaterThanOrEqual(4);
    for (const r of returns) expect(r, r).toMatch(/^return withHeaders\(/);
    expect(src).toMatch(/const plain = [^\n]*"cache-control": "private, no-store"/);
  });

  test("nothing public and nothing readable: no public folder, no robots or sitemap, no source maps", () => {
    expect(filesUnder(path.join(ROOT, "public"))).toEqual([]);
    const app = filesUnder(path.join(ROOT, "app")).map(rel);
    expect(app.filter((f) => /robots|sitemap|manifest|opengraph|\.map$/.test(f))).toEqual([]);
    expect(readFileSync(path.join(ROOT, "next.config.ts"), "utf8")).toMatch(/productionBrowserSourceMaps:\s*false/);
  });
});
