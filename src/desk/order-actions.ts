"use server";
// What staff can do to an order. Each action asks the state machines first and says what they answered. On mock
// data that is where it stops: the write, the event and the outbox rows land with the database.
import { redirect } from "next/navigation";
import { orderTransition, type OrderEvent } from "../domain/order.ts";
import { proofTransition, type ProofEvent } from "../domain/proof.ts";
import type { FiledOrder } from "../orders/book.ts";
import { orderFile } from "../orders/source.ts";
import { ORDER_REF } from "../orders/words.ts";
import { NOTHING_SAVED, saidUrl, type Said } from "../quotes/source.ts";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refused = (reason: string): Said => ({ ok: false, text: reason.charAt(0).toUpperCase() + reason.slice(1) + "." });
const done = (words: string): Said => ({ ok: true, text: `${words}. ${NOTHING_SAVED}` });
const page = (form: FormData, o: FiledOrder | null) => (o && text(form, "from") !== "board" ? `/orders/${o.ref}` : "/orders");

async function orderOf(form: FormData): Promise<FiledOrder | null> {
  const ref = text(form, "ref");
  return ORDER_REF.test(ref) ? orderFile().byRef(ref) : null;
}

// One click, the rules asked, the three effects named.
async function move(form: FormData, event: OrderEvent, words: (o: FiledOrder) => string, proof?: ProofEvent): Promise<void> {
  const o = await orderOf(form);
  if (!o) return redirect(saidUrl("/orders", refused("that order is not here")));
  if (proof) {
    const checked = proofTransition({ state: o.proof.state, round: o.proof.round, sheetSha256: o.proof.sheet_sha256 }, proof, "staff");
    if (!checked.ok) return redirect(saidUrl(page(form, o), refused(checked.code === "missing_note" ? "say what the print house must fix first" : checked.reason)));
  }
  const next = orderTransition({ state: o.state, onHold: o.hold !== null }, event, "staff");
  if (!next.ok) {
    const plain: Record<string, string> = { missing_waybill: "type the waybill number first", missing_reason: "say why first. The client is told", on_hold: "this order is on hold. Release it first" };
    return redirect(saidUrl(page(form, o), refused(plain[next.code] ?? next.reason)));
  }
  return redirect(saidUrl(page(form, o), done(words(o))));
}

export const approveProof = async (form: FormData) => move(form, { type: "proof_approved" }, (o) => `The proof would go to ${o.client.contact_name} to sign, with a message`, { type: "approve" });
// Sent back to the print house, the proof stays with Nelson: the order does not move, so only the proof is asked.
export async function sendProofBack(form: FormData): Promise<void> {
  const o = await orderOf(form);
  if (!o) return redirect(saidUrl("/orders", refused("that order is not here")));
  const checked = proofTransition({ state: o.proof.state, round: o.proof.round, sheetSha256: o.proof.sheet_sha256 }, { type: "send_back", note: text(form, "note") }, "staff");
  return redirect(saidUrl(page(form, o), checked.ok ? done("The print house would be asked for a new sheet") : refused(checked.code === "missing_note" ? "say what the print house must fix first" : checked.reason)));
}
export const placeSupplierOrder = async (form: FormData) => move(form, { type: "supplier_order_placed" }, (o) => `${o.ref} would move to In production and ${o.client.contact_name} would be told`);
export const saveWaybill = async (form: FormData) => move(form, { type: "waybill_saved", waybill: text(form, "waybill") }, (o) => `${o.ref} would move to Dispatched, the tracker would update and ${o.client.contact_name} would get the WhatsApp`);
export const markDelivered = async (form: FormData) => move(form, { type: "delivery_confirmed" }, (o) => `${o.ref} would close as Delivered`);
export const holdOrder = async (form: FormData) => move(form, { type: "hold", reason: text(form, "reason") }, (o) => `${o.ref} would go on hold and ${o.client.contact_name} would be told why`);
export const releaseOrder = async (form: FormData) => move(form, { type: "release" }, (o) => `${o.ref} would come off hold and ${o.client.contact_name} would be told`);
