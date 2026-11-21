"use server";
// Talking to a client from their page. On mock data each action checks and says what would go out; the WhatsApp
// send itself is one outbox row per message and lands with the channel (brief phase 4).
import { redirect } from "next/navigation";
import { orderFile } from "../orders/source.ts";
import { latestVersion } from "../quotes/book.ts";
import { NOTHING_SAVED, quoteBook, saidUrl, type Said } from "../quotes/source.ts";
import { rand } from "../ui/format.ts";
import { clientPage } from "./clients.ts";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refused = (reason: string): Said => ({ ok: false, text: `${reason}.` });
const clientOf = (form: FormData) => clientPage(quoteBook(), orderFile(), text(form, "client"), new Date());

export async function messageClient(form: FormData): Promise<void> {
  const c = await clientOf(form);
  if (!c) return redirect(saidUrl("/clients", refused("That client is not here")));
  if (!text(form, "message")) return redirect(saidUrl(`/clients/${c.id}`, refused("Write the message first")));
  return redirect(saidUrl(`/clients/${c.id}`, { ok: true, text: `${c.contact} would get your message on WhatsApp. ${NOTHING_SAVED}` }));
}

export async function sendQuoteToClient(form: FormData): Promise<void> {
  const c = await clientOf(form);
  if (!c) return redirect(saidUrl("/clients", refused("That client is not here")));
  const quote = await quoteBook().byRef(text(form, "ref"));
  // Only this client's own sent quote can go into this client's conversation.
  if (!quote || quote.client.id !== c.id || !c.sendable.some((q) => q.ref === quote.ref)) return redirect(saidUrl(`/clients/${c.id}`, refused("That quote cannot be sent to this client")));
  return redirect(saidUrl(`/clients/${c.id}`, { ok: true, text: `${c.contact} would get ${quote.ref} on WhatsApp: the total, ${rand(latestVersion(quote)!.totals.total_cents)}, the PDF and a link to open it. ${NOTHING_SAVED}` }));
}
