# Architecture blueprint, section h: Nelson Desk and Portal

Draft for Alan, 20 Nov 2026. Paste under section g of the Architecture blueprint in Nelson HQ. Nothing has been written to Notion. Section g then needs one added line, given at the foot.

---

## h. Nelson Desk and Portal

Decision, 20 Nov 2026, Alan: the Desk follows the current system. Prices come from Nelson's master rule, the mark-up column is read-only, and the Desk holds no formula. It is built as a separate project: repo `vibecoderza/nelson-desk`, its own Neon project, its own Vercel project.

What it is. Nelson's back office (the Desk, `desk.dearnelson.co.za`, staff) and the client portal (the Portal, `my.dearnelson.co.za`, clients). One Next.js app, one database, two hosts with separate sign-ins. The full brief is `docs/brief.md` in the repo.

### The seam

Three rules. Break one and we run two businesses.

- **One price rule.** Every price on a quote or an order comes from the studio host's `POST /api/v1/price`. The Desk holds no formula, no mark-up, no multiplier and no rounding ladder. A manual price needs Alan's name and a reason on the line.
- **One product truth.** Shopify plus Nelson's spec, by `nelson.product_code`. The Desk keeps no catalogue of its own.
- **One order file.** Every order, from the cart or from a quote, is one `nelson.order-pack/1` on one board.

### System map addition

```mermaid
flowchart LR
  subgraph Vercel studio host
    PRICE[/api/v1/price/]
    SPEC[/api/v1/spec/]
    DEL[/api/v1/delivery-estimate/]
    ORD[/api/v1/orders/]
    EVIN[/api/v1/events/]
  end
  subgraph Desk and Portal - own Vercel project, own Neon
    DESK[desk.dearnelson.co.za - staff, second factor]
    PORTAL[my.dearnelson.co.za - clients]
    DB[(Postgres: event, outbox, portal views)]
  end
  DESK -- key-signed HTTPS JSON --> PRICE
  DESK --> SPEC
  DESK --> DEL
  DESK -- order from quote, mark paid, status --> ORD
  DESK -- signed events --> EVIN
  ORD -- signed events --> DESK
  DESK --- DB
  PORTAL --- DB
```

- The Desk never connects to Nelson's Neon. Nelson never reads the Desk's database.
- Integration is HTTPS JSON and signed events only, as written in `contract/openapi.yaml` in the Desk repo. That file is the contract; both sides are tested against it.
- Events carry the `nelson.event/1` envelope, an HMAC-SHA256 signature over the timestamp and raw body, a five-minute window and an idempotency key. Two shared secrets exist, named `DESK_WEBHOOK_SECRET` and `PORTAL_TOKEN_SIGNING_KEY`. Alan sets both in each Vercel project. Their values appear nowhere else.

### What Nelson builds for it

New on the studio host, as cards after the 27 Nov freeze: `/api/v1/price` (customer view, and a staff view behind a second key), `/api/v1/delivery-estimate`, `/api/v1/orders/from-quote`, `/api/v1/orders/{ref}/mark-paid`, `/api/v1/orders/{ref}/status`, events out and `/api/v1/events` in. The customer view of a price goes out through `publicProduct` rules: no supplier, cost, tier or mark-up.

Until those land the Desk is built against its own mock of the contract. No change to the live MAIN theme, the catalogue lanes, Nelson's Neon or the pricing files.

### Nothing exposed, applied to the Desk

- Supplier, supplier code, cost, tier, mark-up and margin show to staff on the Desk and never leave it. The Portal, the official PDF and every client message carry the customer view only.
- Two walls. The host decides the surface, and the Portal's database role reads through views that leave the staff tables out.
- The Desk has no public routes. Staff sign in from an allow-list with a second factor. Every Desk response is `private, no-store`.
- Previews need a login. Only the two live hosts serve anything.
- Two exposure tests run on every build: `test/exposure-portal.test.ts` and `test/exposure-staff.test.ts`. They are never weakened to make a build pass.

### One event, three effects

Every state change is one function that writes the new state, one `event` row and one `outbox` row per effect in one transaction. Screens and messages read `event` and `notification`. Nothing sends a message outside the outbox.

### Gates

Decisions 1 to 3 (done, 20 Nov). This section. Nelson's cards after the 27 Nov freeze. Contract tests green on a Nelson preview. One test order end to end on a preview theme. Live payments only behind Nelson's own checkout gate.

---

Line to add to **g. Change control**:

- Any PR in either repo that puts a price formula, supplier cost or a second order file outside the seam in section h is stopped. A change to the contract is a change to `contract/openapi.yaml` first, reviewed on both sides.
