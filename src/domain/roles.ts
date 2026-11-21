// Client roles (brief 3.6). Owner, Buyer with a spend limit, Viewer.
import type { SignerRole } from "./proof.ts";

export type ClientRole = SignerRole;
export type ClientAction = "view" | "request_quote" | "change_quote" | "accept_quote" | "sign_proof" | "manage_team" | "manage_brand_kit" | "manage_settings";

// Decision 7, recommended default: the Owner signs proofs; a Buyer accepts quotes within their limit.
export function clientMay(role: ClientRole, action: ClientAction, opts: { amountCents?: number; spendLimitCents?: number | null } = {}): boolean {
  if (role === "owner") return true;
  if (role === "viewer") return action === "view";
  switch (action) {
    case "view":
    case "request_quote":
    case "change_quote":
      return true;
    case "accept_quote":
      return opts.spendLimitCents != null && opts.amountCents != null && opts.amountCents <= opts.spendLimitCents;
    default:
      return false;
  }
}
