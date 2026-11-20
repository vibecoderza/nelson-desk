# Phase 0 cards

Brief sections 8 and 12. No card, no work. Every card carries: conforms to Architecture blueprint (section h), both exposure tests green.

## Done in this repo

| Card | Acceptance | Proof |
| --- | --- | --- |
| 0.1 Repo and rules | Private repo, `CLAUDE.md` carries brief 7.8 | `CLAUDE.md` |
| 0.2 Contract | OpenAPI 3.1 for brief section 6, a schema and a fixture for every body, customer shapes closed | `contract/`, `test/contract.test.ts` |
| 0.3 Mock Nelson | Serves the contract, validates every request, signs events, replays idempotent posts | `mock/server.ts`, `npm run mock` |
| 0.4 State machines | Quote, line, amendment, order, proof as pure functions, every refusal named | `src/domain/`, `test/state-machines.test.ts` |
| 0.5 Database | Brief 7.4 tables, staff-only tables apart, sent quote versions frozen, events never deleted | `prisma/`, `test/backbone.test.ts` |
| 0.6 Event backbone and outbox | One transaction writes state, event and outbox rows; worker retries with backoff; a failure shows as an event | `src/backbone/` |
| 0.7 Exposure tests | Portal: every customer shape, the event log, the outbox and the Portal's database role walked for private keys and supplier names. Desk: no public routes, allow-list, second factor, `private, no-store` | `test/exposure-portal.test.ts`, `test/exposure-staff.test.ts` |
| 0.8 Front door and sign-in | Two hosts, two Clerk applications, default deny | `proxy.ts`, `src/surface/`, `docs/auth.md` |

## Open, Alan's hands

| Card | What |
| --- | --- |
| 0.9 Blueprint section h | Paste `docs/blueprint-section-h.md` into the Architecture blueprint |
| 0.10 Clerk | Create the Desk application, set both applications up as in `docs/auth.md` |
| 0.11 Neon | New project for the Desk. Run `0001_init` then `0002_walls`. Give the Portal's login role membership of `desk_portal` |
| 0.12 Vercel | New project on this repo, the two domains, the names in `.env.example`, deployment protection on previews |
| 0.13 Meta | Start WhatsApp Business verification (phase 4 waits on it) |

## Open, Nelson's side (after the 27 Nov freeze)

Cards for the studio host, written from `contract/openapi.yaml`: price (customer and staff views), delivery estimate, order from quote, mark paid, order status, events out, events in. The customiser thread's three shapes are marked provisional in `contract/schemas/customiser-provisional.json` until it publishes them.

## Calls made in the build, for Alan to overrule

1. A first version whose lines are all agreed lands on Final, not Draft.
2. Payment is the accept. The quote moves to accepted on the `paid` event, as the brief has it.
3. An order moves forward only. One step back exists: a proof sent back.
4. Only the Owner signs a proof (decision 7's default).
5. Money in the contract is integer cents, everywhere.
6. Which member of staff did a thing is hidden from the Portal: every `*_staff_id` column is left out of its views.
7. `0002_walls` is generated from the allow-list in `src/portal/views.ts` and regenerated in place until the first deploy. After that, every change is a new migration.
