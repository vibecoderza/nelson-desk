"use server";
// Turning a message into work. On mock data it says what would open; the draft quote itself lands with the database.
import { redirect } from "next/navigation";
import { NOTHING_SAVED, saidUrl } from "../quotes/source.ts";
import { inbound } from "./inbox.ts";

export async function startQuote(form: FormData): Promise<void> {
  const message = inbound().find((m) => m.id === String(form.get("id") ?? ""));
  if (!message || !message.read) return redirect(saidUrl("/inbox", { ok: false, text: "There is nothing read from that message to start a quote with." }));
  const forWhom = message.client_id ? message.who : "a new client, in Draft";
  return redirect(saidUrl("/inbox", { ok: true, text: `A draft quote would open for ${forWhom}, starting from “${message.read}”. Nothing is priced until Nelson is asked. ${NOTHING_SAVED}` }));
}
