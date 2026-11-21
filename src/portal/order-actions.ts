"use server";
// What a client can do to an order. Each action asks the state machines first and says what they answered. On mock
// data that is where it stops: the write, the evidence record, the event and the outbox rows land with the database.
import { redirect } from "next/navigation";
import { orderTransition } from "../domain/order.ts";
import { PROOF_CHECKS, proofTransition, type Proof } from "../domain/proof.ts";
import { targetDate, type FiledOrder } from "../orders/book.ts";
import { orderFile } from "../orders/source.ts";
import { ORDER_REF } from "../orders/words.ts";
import { NOTHING_SAVED, saidUrl, type Said } from "../quotes/source.ts";
import { day } from "../ui/format.ts";
import { portalClientId, portalRole } from "./who.ts";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function ownOrder(form: FormData): Promise<FiledOrder | null> {
  const ref = text(form, "ref");
  if (!ORDER_REF.test(ref)) return null;
  const order = await orderFile().byRef(ref);
  return order && order.client.id === portalClientId() ? order : null;
}
const back = (o: FiledOrder | null, page: "" | "/proof", said: Said): never => redirect(saidUrl(o ? `/orders/${o.ref}${page}` : "/orders", said));
const refused = (reason: string): Said => ({ ok: false, text: reason.charAt(0).toUpperCase() + reason.slice(1) + "." });
const proofOf = (o: FiledOrder): Proof => ({ state: o.proof.state, round: o.proof.round, sheetSha256: o.proof.sheet_sha256 });

const SIGN_REFUSALS: Record<string, string> = {
  checks_incomplete: "tick all four checks first",
  missing_name: "type your full name",
  missing_signature: "type your signature",
  not_allowed: "only an Owner on your account can sign a proof",
  sheet_changed: "a newer proof has arrived. Open it and check again",
};

export async function signProof(form: FormData): Promise<void> {
  const o = await ownOrder(form);
  if (!o) return back(null, "", refused("that order is not here"));
  const checks = PROOF_CHECKS.filter((c) => form.get(c) === "on");
  const signed = proofTransition(proofOf(o), { type: "sign", role: portalRole(), name: text(form, "name"), signature: text(form, "signature"), checks, sheetSha256: text(form, "sheet") }, "client");
  if (!signed.ok) return back(o, "/proof", refused(SIGN_REFUSALS[signed.code] ?? "this proof is not waiting on a signature"));
  const moved = orderTransition({ state: o.state, onHold: o.hold !== null }, { type: "proof_signed" }, "client");
  if (!moved.ok) return back(o, "/proof", refused(moved.code === "on_hold" ? "this order is on hold. We will be in touch" : moved.reason));
  const signedNow: FiledOrder = { ...o, proof: { ...o.proof, signed: { name: text(form, "name"), at: new Date() } } };
  return back(o, "", { ok: true, text: `The proof would be signed and locked, and the order would go to production for ${day(targetDate(signedNow, new Date()))}. ${NOTHING_SAVED}` });
}

export async function askForProofChange(form: FormData): Promise<void> {
  const o = await ownOrder(form);
  if (!o) return back(null, "", refused("that order is not here"));
  const asked = proofTransition(proofOf(o), { type: "request_change", note: text(form, "note") }, "client");
  if (!asked.ok) return back(o, "/proof", refused(asked.code === "missing_note" ? "say what to change first" : "this proof is not waiting on you"));
  const moved = orderTransition({ state: o.state, onHold: o.hold !== null }, { type: "proof_returned" }, "client");
  if (!moved.ok) return back(o, "/proof", refused(moved.reason));
  return back(o, "", { ok: true, text: `Nelson would get your change and send a new proof. ${NOTHING_SAVED}` });
}

export async function askOnOrder(form: FormData): Promise<void> {
  const o = await ownOrder(form);
  if (!o) return back(null, "", refused("that order is not here"));
  if (!text(form, "message")) return back(o, "", refused("write the message first"));
  return back(o, "", { ok: true, text: `Your message would go to Nelson on ${o.ref}. ${NOTHING_SAVED}` });
}
