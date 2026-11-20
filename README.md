# nelson-desk

Nelson's back office (the Desk) and its client portal (the Portal). Private.

- `CLAUDE.md`: the rules every build follows.
- `docs/brief.md`: the project brief (19 Nov 2026).
- `docs/cards/phase-0.md`: the phase 0 cards and what is still open.
- `docs/auth.md`: sign-in, two Clerk applications, what to set where.
- `docs/blueprint-section-h.md`: draft of the Architecture blueprint's section h.
- `contract/openapi.yaml`: the contract with Nelson. Schemas and fixtures sit beside it.

## Run

```
npm install
npm test            # state machines, contract, backbone, both exposure tests
npm run typecheck
npm run mock        # a stand-in Nelson on the contract
npm run build
```

Tests need no database and no keys: Postgres runs in-process and Nelson is the mock.

Locally the two hosts are `desk.localhost:3000` and `my.localhost:3000`. Any other host serves nothing.

## Database

`npm run db:sql` rewrites `prisma/migrations/0001_init` from `prisma/schema.prisma` and `0002_walls` (the Portal's views, role and triggers) from `src/portal/views.ts`. Both are regenerated in place until the first deploy. After that, every change is a new migration.

## Secrets

Names in `.env.example`. Values in Vercel, set by Alan. Never in the repo, a brief, a ticket or a chat.
