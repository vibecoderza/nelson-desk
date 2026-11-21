// Which client is looking. With a database this is the signed-in person's Clerk Organisation, matched to a client
// row. On mock data every signed-in Portal session sees the one demonstration client.
import { MOCK_PORTAL_CLIENT_ID } from "../mock/book.ts";
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";

export function portalClientId(): string {
  if (mockBookInUse()) return MOCK_PORTAL_CLIENT_ID;
  throw new NotBuiltYet("Matching a Portal session to its client");
}

// What the signed-in person may do for their client (brief 3.6). On mock data the one demonstration person owns
// the account, so they can sign a proof.
import type { SignerRole } from "../domain/proof.ts";
export function portalRole(): SignerRole {
  if (mockBookInUse()) return "owner";
  throw new NotBuiltYet("Reading a Portal person's role");
}
