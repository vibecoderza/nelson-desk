// The proof (brief 3.4). Nothing is made unsigned.
import { createHash } from "node:crypto";
import { ok, refuse, type Actor, type Result } from "./result.ts";

export const PROOF_STATES = ["awaiting_sheet", "with_nelson", "with_client", "signed"] as const;
export type ProofState = (typeof PROOF_STATES)[number];

export type Proof = { state: ProofState; round: number; sheetSha256: string | null };

// The four ticks the client gives before signing.
export const PROOF_CHECKS = ["spelling", "colours", "size_and_position", "this_is_what_gets_made"] as const;
export type ProofCheck = (typeof PROOF_CHECKS)[number];

export type SignerRole = "owner" | "buyer" | "viewer";

export type ProofEvent =
  | { type: "sheet_uploaded"; sheetSha256: string } // the print house, through its signed upload link
  | { type: "approve" } // Alan checks it against the signed-off design revision
  | { type: "send_back"; note: string } // Alan sends it back to the print house
  | { type: "request_change"; note: string } // the client. A new sheet restarts the proof
  | { type: "sign"; role: SignerRole; name: string; signature: string; checks: readonly ProofCheck[]; sheetSha256: string };

const SHA256 = /^[0-9a-f]{64}$/;

export function proofTransition(proof: Proof, event: ProofEvent, actor: Actor): Result<Proof> {
  const { state, round } = proof;
  const wrongState = () => refuse("wrong_state", `${event.type} is not allowed from ${state}`);
  const wrongActor = (by: Actor) => refuse("wrong_actor", `${event.type} is fired by ${by}, not ${actor}`);

  switch (event.type) {
    case "sheet_uploaded":
      if (actor !== "auto") return wrongActor("auto");
      if (state === "signed") return refuse("locked", "a signed proof is locked");
      if (!SHA256.test(event.sheetSha256)) return refuse("bad_fingerprint", "the sheet needs its SHA-256 fingerprint");
      return ok({ state: "with_nelson", round: round + 1, sheetSha256: event.sheetSha256 });

    case "approve":
      if (actor !== "staff") return wrongActor("staff");
      if (state !== "with_nelson") return wrongState();
      return ok({ ...proof, state: "with_client" });

    case "send_back":
      if (actor !== "staff") return wrongActor("staff");
      if (state !== "with_nelson") return wrongState();
      if (!event.note.trim()) return refuse("missing_note", "the print house needs to know what to fix");
      return ok({ state: "awaiting_sheet", round, sheetSha256: null });

    case "request_change":
      if (actor !== "client") return wrongActor("client");
      if (state !== "with_client") return wrongState();
      if (!event.note.trim()) return refuse("missing_note", "a change request says what to change");
      return ok({ state: "awaiting_sheet", round, sheetSha256: null });

    case "sign":
      if (actor !== "client") return wrongActor("client");
      if (state !== "with_client") return wrongState();
      // Decision 7, recommended default: only an Owner signs a proof.
      if (event.role !== "owner") return refuse("not_allowed", "only an Owner can sign a proof");
      if (!event.name.trim()) return refuse("missing_name", "the signer types their name");
      if (!event.signature.trim()) return refuse("missing_signature", "the signer draws or types a signature");
      for (const check of PROOF_CHECKS) if (!event.checks.includes(check)) return refuse("checks_incomplete", `not ticked: ${check}`);
      if (event.sheetSha256 !== proof.sheetSha256) return refuse("sheet_changed", "the sheet on screen is not the current sheet");
      return ok({ ...proof, state: "signed" });
  }
}

// The evidence record (brief 3.4, step 4): what was signed, by whom, when, from where, and the exact words shown.
export type SignatureEvidence = {
  proofRef: string; // PP-1042
  round: number;
  name: string;
  signature: string; // typed text, or the drawn signature as an SVG path
  signedAt: string; // ISO 8601, UTC
  ip: string;
  userAgent: string;
  wordsShown: string; // the statement and the four checks, exactly as the client saw them
  checks: readonly ProofCheck[];
  sheetSha256: string;
  recordSha256: string; // fingerprint of everything above, so the record itself is tamper-evident
};

export const sha256Hex = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

export function buildEvidence(input: Omit<SignatureEvidence, "recordSha256" | "signedAt"> & { signedAt: Date }): SignatureEvidence {
  const record = { ...input, checks: [...input.checks].sort(), signedAt: input.signedAt.toISOString() };
  // Keys in a fixed order, so the same signing always gives the same fingerprint.
  const canonical = JSON.stringify(record, Object.keys(record).sort());
  return { ...record, recordSha256: sha256Hex(canonical) };
}

export function evidenceIsIntact(evidence: SignatureEvidence): boolean {
  const { recordSha256, ...rest } = evidence;
  return sha256Hex(JSON.stringify(rest, Object.keys(rest).sort())) === recordSha256;
}
