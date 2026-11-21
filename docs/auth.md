# Sign-in: two Clerk applications

Decision, 20 Nov 2026, Alan: two Clerk applications. One for the Desk, one for the Portal. Two applications give two sessions, two cookie scopes and two sets of rules. A client's session cannot open the Desk because it belongs to a different application.

The existing application becomes the Portal's. The Desk gets a new one.

## What Alan sets up

Never run `clerk init` in this repo. It can create a replacement application and overwrite keys. Clerk is wired by hand here. Run `clerk auth login` yourself if you use the CLI.

**Desk application (new)**

1. Create it in the Clerk dashboard. Name it Nelson Desk.
2. Sign-in: email link or email code. No social sign-in.
3. Restrictions: sign-up mode Restricted, allow-list on, staff emails only.
4. Multi-factor: authenticator app on and required.
5. Sessions, customise session token, add one claim: `{"email": "{{user.primary_email_address}}"}`. The Desk reads the staff allow-list against it.
6. Agent access and impersonation tokens: off.
7. Production domain: `desk.dearnelson.co.za`.

**Portal application (existing)**

1. Sign-in: Google and email link.
2. Organisations: on. One organisation per client. Add the roles `org:owner`, `org:buyer` and `org:viewer`. Default role for a new member: viewer.
3. Agent access: off, until agent sessions are restricted (brief 3.8).
4. Production domain: `my.dearnelson.co.za`.

**Vercel (and your own local env file)**

Names are in `.env.example`. Values go in Vercel only. Never in the repo, a brief, a ticket or a chat.

| Name | From |
| --- | --- |
| `CLERK_DESK_PUBLISHABLE_KEY`, `CLERK_DESK_SECRET_KEY` | Desk application, API keys |
| `CLERK_PORTAL_PUBLISHABLE_KEY`, `CLERK_PORTAL_SECRET_KEY` | Portal application, API keys |
| `CLERK_ENCRYPTION_KEY` | `openssl rand -hex 32`. Needed because the key is chosen per request |
| `DESK_STAFF_EMAILS` | Comma-separated. The second lock behind Clerk's own allow-list |

Do not set Clerk's default names (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`). With them one application would serve both hosts. A test checks they stay out.

## How the code uses it

- `proxy.ts` places every request on a surface by its host, then asks `src/surface/access.ts` whether it passes. Default deny.
- The Clerk keys are picked per request by surface (`src/surface/clerk.ts`). No keys for a surface: 503, and no stand-in application is made (keyless mode is off).
- Desk rule: on the staff list, second factor verified in this session, not a delegated session. Otherwise 403.
- Second factor, for now (Alan, 21 Nov 2026): multi-factor is a paid Clerk feature, so the Desk runs on the allow-list alone until it holds real data. `DESK_SECOND_FACTOR=off` skips the factor only while `DATABASE_URL` and `DATABASE_URL_PORTAL` are both unset. Setting either one puts the factor back, whatever the switch says. Before the Neon card: upgrade the Desk Clerk app, turn on an authenticator, delete the switch.
- Portal rule: signed in and not a delegated session. The client role comes from the organisation role. An unknown role is no role.
- Machine routes carry their own credential and belong to one host: the Nelson webhook (signature), the outbox cron (bearer), health.

## Looking at a pull request before it merges

Both Clerk applications are tied to `dearnelson.co.za`, so a Vercel preview cannot sign anyone in with them. While the app runs on sample data, a preview serves the two surfaces on its own two addresses with Vercel's login as the door: the branch address is the Desk, the deployment's own address is the Portal (`src/surface/preview.ts`).

It answers only when Vercel marks the deployment a preview, no database is configured and Nelson has no address. The live hosts never qualify. Setting `DATABASE_URL`, `DATABASE_URL_PORTAL` or `NELSON_BASE_URL` on Preview closes it. Keep Vercel Authentication on for previews: it is the only lock on this door.

## Not proven yet

- Nothing here has run against live Clerk. No keys existed in the build session, by design. First sign-in on a preview is the test.
- The delegated-session check reads the `act` and `agent` claims. `act` is Clerk's documented actor claim. `agent` is a guess. The real lock is the dashboard setting: agent access off.
- The second-factor check reads the `fva` claim. If the Desk application's token version does not carry it, every staff sign-in is refused. That fails closed, and it is the first thing to check.
