# nelson-desk: rules for every build

Nelson Desk (staff, `desk.dearnelson.co.za`) and the Client Portal (clients, `my.dearnelson.co.za`). One Next.js app, one database, two surfaces. Direction lives in the North Star (claude.ai project NELSON, `strategy/northstar.md`) and in `docs/brief.md`. Read both before strategic, pricing, delivery or brand work.

## The seam (brief section 6). Break one and we run two businesses.
1. **One price rule.** Every price comes from Nelson's `POST /api/v1/price`. This repo holds no formula, no mark-up, no multiplier and no rounding ladder. A manual price needs Alan's name and a reason on the line.
2. **One product truth.** Shopify plus Nelson's spec, by our product code.
3. **One order file.** Every order, cart or quote, is one `nelson.order-pack/1` on one board.

The Desk never connects to Nelson's Neon. Nelson never reads this database. Integration is HTTPS JSON and signed webhooks, as written in `contract/openapi.yaml`.

## Nothing exposed (North Star 3.10)
Everything we build is private. Nothing may be accessed or copied directly from what we serve.
- Supplier, supplier code, cost, tier, mark-up and margin show to staff on the Desk and never leave it. The Portal, the official PDF and every client message carry the customer view only.
- Staff-only data lives in `quote_line_staff` and `order_line_staff`. Portal code reads through the `portal` schema's views with the `desk_portal` role, which cannot select from them.
- Portal code (`src/portal`, `app/portal`) never imports from `src/desk`.
- Desk pages are server-rendered and sent `Cache-Control: private, no-store`. The Desk has no public routes.
- No source maps, comments or readable source in anything public. Minified builds only.
- Storage is private. Signed short-lived links or a login; never a public URL.
- Customer-facing copy never names a supplier, a supplier code or a price table.
- Previews need a login; only the live custom domains are public.
- Prefer an API that returns the answer over shipping the logic or data to the browser.
- Every new public surface gets a check in `test/exposure-portal.test.ts` or `test/exposure-staff.test.ts`. Never weaken those checks to make a build pass.

## One event, three effects (brief section 7.3)
Every state change is one function that writes the new state, one `event` row and one `outbox` row per effect, in one transaction (`src/backbone`). Screens and messages read `event` and `notification`. Nothing writes those screens directly, and nothing sends a message outside the outbox.

## Secrets
Named in `.env.example`, set by Alan in Vercel. Values never appear in the repo, a brief, a ticket or a chat. Never read or print an environment file.

## Also
- British English in copy and docs.
- No AI-generated product photos.
- Never publish or modify the live Shopify MAIN theme; never edit the live `piobox-pdp.js`. Touch nothing in `nelson-master` from here.
- No VAT line, label or step anywhere. Nelson is not VAT registered.
- Money is integer cents, ZAR. Time is stored UTC and shown SAST.
- No card, no work. No lesson, no close.
