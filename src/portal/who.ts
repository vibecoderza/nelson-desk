// Which client is looking. With a database this is the signed-in person's Clerk Organisation, matched to a client
// row. On mock data every signed-in Portal session sees the one demonstration client.
import { MOCK_PORTAL_CLIENT_ID } from "../mock/book.ts";
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";

export function portalClientId(): string {
  if (mockBookInUse()) return MOCK_PORTAL_CLIENT_ID;
  throw new NotBuiltYet("Matching a Portal session to its client");
}
