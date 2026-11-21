// The Portal's Settings: the client's own company, where things are delivered, which updates reach them how, and
// who is on their team. Passed through the exposure walk like every Portal view.
import { assertPortalSafe } from "../exposure/private.ts";
import type { OrderFile } from "../orders/book.ts";
import type { QuoteBook } from "../quotes/book.ts";
import { rand } from "../ui/format.ts";

export const UPDATE_KINDS = ["quotes", "proofs", "orders", "ideas"] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];
type UpdateRow = { kind: UpdateKind; title: string; sub: string; email: boolean; whatsapp: boolean; locked: boolean };
export type PortalSettings = {
  client_name: string; may_change: boolean;
  company: { label: string; words: string }[];
  updates: UpdateRow[];
  team: { name: string; role: string; sub: string; you: boolean }[];
};

// Order updates always go out: a client is never left guessing where their order is (brief 3.8).
const UPDATE_WORDS: Record<UpdateKind, [string, string, boolean]> = {
  quotes: ["Quotes", "A new quote, a new version, a reminder before it closes", false],
  proofs: ["Proofs", "A proof is ready to sign", false],
  orders: ["Order updates", "In production, on the road, delivered. Always on", true],
  ideas: ["Ideas from Nelson", "New mockups made with your brand kit", false],
};

export async function portalSettings(quotes: QuoteBook, file: OrderFile, clientId: string, mayChange: boolean): Promise<PortalSettings | null> {
  const [mine, orders] = await Promise.all([quotes.forClient(clientId), file.forClient(clientId)]);
  const client = [...mine.map((q) => q.client), ...orders.map((o) => o.client)].find((c) => c.id === clientId);
  if (!client) return null;
  return assertPortalSafe({
    client_name: client.name, may_change: mayChange,
    company: [{ label: "Company", words: client.name }, { label: "Deliver to", words: client.address_words }, { label: "Contact", words: `${client.contact_name} · ${client.contact_email}` }, { label: "WhatsApp", words: `Number ending ${client.phone_tail}` }],
    updates: UPDATE_KINDS.map((kind) => ({ kind, title: UPDATE_WORDS[kind][0], sub: UPDATE_WORDS[kind][1], email: true, whatsapp: kind !== "ideas", locked: UPDATE_WORDS[kind][2] })),
    // Sample team: the contact owns the account; one sample Buyer shows what a limit looks like.
    team: [{ name: client.contact_name, role: "Owner", sub: "Signs proofs, accepts and pays, manages the team", you: true }, { name: "Sample Buyer", role: "Buyer", sub: `Accepts quotes up to ${rand(1_000_000)}`, you: false }],
  }, "the Portal's settings");
}
