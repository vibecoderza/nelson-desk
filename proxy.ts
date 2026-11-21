// The front door. Every request is placed on a surface by its host, checked, and only then served.
// Next.js 16 calls this file proxy.ts (it was middleware.ts).
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { decide, responseHeaders, surfaceForHost, type Decision, type Surface } from "./src/surface/access.ts";
import { previewDecide, previewSurface } from "./src/surface/preview.ts";
import { clerkKeys, hostsFromEnv, secondFactorRequiredFromEnv, sessionFrom, staffEmailsFromEnv } from "./src/surface/clerk.ts";

const withHeaders = (res: NextResponse, surface: Surface, decision: Decision) => {
  for (const [k, v] of Object.entries(responseHeaders(surface, decision))) res.headers.set(k, v);
  return res;
};
const plain = (status: number, text: string) => new NextResponse(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" } });

const surfaceOf = (req: NextRequest) => surfaceForHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"), hostsFromEnv());

const guarded = clerkMiddleware(
  async (auth, req) => {
    const surface = surfaceOf(req)!;
    const decision = decide(surface, req.nextUrl.pathname, sessionFrom(await auth()), staffEmailsFromEnv(), secondFactorRequiredFromEnv());
    switch (decision.action) {
      case "page": {
        const url = req.nextUrl.clone();
        url.pathname = decision.rewriteTo;
        return withHeaders(NextResponse.rewrite(url), surface, decision);
      }
      case "sign_in": {
        const url = req.nextUrl.clone();
        url.pathname = "/sign-in";
        url.search = "";
        return withHeaders(NextResponse.redirect(url), surface, decision);
      }
      case "refuse":
        return withHeaders(plain(403, decision.reason === "second_factor_required" ? "A second factor is needed to open the Desk." : "This account cannot open this page."), surface, decision);
      default:
        return withHeaders(plain(404, "Not found"), surface, decision);
    }
  },
  (req) => {
    const keys = clerkKeys(surfaceOf(req)!)!;
    return { publishableKey: keys.publishableKey, secretKey: keys.secretKey, signInUrl: "/sign-in" };
  },
);

// A preview deployment on sample data, behind Vercel's login. See src/surface/preview.ts for when this answers.
function preview(req: NextRequest, surface: Surface) {
  const decision = previewDecide(surface, req.nextUrl.pathname);
  if (decision.action === "machine") return withHeaders(NextResponse.next(), surface, decision);
  if (decision.action !== "page") return withHeaders(plain(404, "Not found"), surface, decision);
  const url = req.nextUrl.clone();
  url.pathname = decision.rewriteTo;
  return withHeaders(NextResponse.rewrite(url), surface, decision);
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const surface = surfaceOf(req);
  // Only a host the real front door does not know is ever offered to the preview look.
  const looking = surface ? null : previewSurface(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  if (looking) return preview(req, looking);
  if (!surface) return plain(404, "Not found");
  // Machine routes carry their own credential and never touch a session.
  const first = decide(surface, req.nextUrl.pathname, null, []);
  if (first.action === "machine") return withHeaders(NextResponse.next(), surface, first);
  if (first.action === "not_found" && !req.nextUrl.pathname.startsWith("/api")) return withHeaders(plain(404, "Not found"), surface, first);
  // Fail closed: without this surface's Clerk keys nothing behind a login is served, and no stand-in app is made.
  if (!clerkKeys(surface)) return plain(503, "Sign-in is not set up yet.");
  return guarded(req, event);
}

export const config = {
  // Everything except Next's own static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
