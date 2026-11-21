// The mockup shop (brief 3.7): every piece this client has had quoted or ordered, once each, picture first. It is
// worked out from their own sent quotes and orders, so it holds nothing new. A price here is a guide: Nelson's own
// quoted price at a stated quantity. The price at the client's quantity comes from Nelson on the new quote.
import { assertPortalSafe } from "../exposure/private.ts";
import type { OrderFile } from "../orders/book.ts";
import type { QuoteBook } from "../quotes/book.ts";

export type ShopItem = {
  id: string; name: string; colour: string; picture: string | null; tiles: string[]; decoration_words: string;
  guide: { unit_cents: number; quantity: number } | null; ordered: boolean; from_ref: string; from_href: string;
};
export type PortalShop = { client_name: string; filter: "all" | "ordered"; counts: { all: number; ordered: number }; items: ShopItem[] };

export const SHOP_ITEM_ID = /^si_[a-z0-9-]{1,80}$/;
const idOf = (name: string, colour: string) => `si_${`${name.replace(/^the\s+/i, "")}-${colour}`.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}`;

export async function shopItems(quotes: QuoteBook, file: OrderFile, clientId: string): Promise<{ client_name: string | null; items: ShopItem[] }> {
  const [mine, orders] = await Promise.all([quotes.forClient(clientId), file.forClient(clientId)]);
  const items = new Map<string, ShopItem>();
  // Newest sent quote first, so a piece shows as it was last quoted.
  const sent = mine.filter((q) => q.client.id === clientId && q.versions.length > 0).sort((a, b) => (b.last_sent_at?.getTime() ?? 0) - (a.last_sent_at?.getTime() ?? 0));
  for (const q of sent) {
    for (const l of q.versions.at(-1)!.lines) {
      const id = idOf(l.product_name, l.colour);
      if (items.has(id)) continue;
      // The guide is the middle of what Nelson quoted, or the one price there is.
      const mid = l.ladder.length > 0 ? l.ladder[Math.floor((l.ladder.length - 1) / 2)]! : null;
      const guide = mid ? { unit_cents: mid.unit_cents, quantity: mid.min_quantity } : l.unit_cents != null ? { unit_cents: l.unit_cents, quantity: l.quantity } : null;
      items.set(id, { id, name: l.product_name, colour: l.colour, picture: l.picture, tiles: [l.colour_hex], decoration_words: l.decoration_words, guide, ordered: false, from_ref: q.ref, from_href: `/quotes/${q.ref}` });
    }
  }
  for (const o of orders.filter((o) => o.client.id === clientId && o.state !== "cancelled").sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime())) {
    for (const l of o.lines) {
      const id = idOf(l.product_name, l.colour);
      const have = items.get(id);
      if (have?.ordered) continue;
      items.set(id, have
        ? { ...have, ordered: true, picture: have.picture ?? l.picture, from_ref: o.ref, from_href: `/orders/${o.ref}` }
        : { id, name: l.product_name, colour: l.colour, picture: l.picture, tiles: [l.colour_hex], decoration_words: l.decoration_words, guide: null, ordered: true, from_ref: o.ref, from_href: `/orders/${o.ref}` });
    }
  }
  const name = mine[0]?.client.name ?? orders[0]?.client.name ?? null;
  // Ordered pieces first, then the ones with a mockup, each by name.
  return { client_name: name, items: [...items.values()].sort((a, b) => Number(b.ordered) - Number(a.ordered) || Number(b.picture !== null) - Number(a.picture !== null) || a.name.localeCompare(b.name)) };
}

export async function portalShop(quotes: QuoteBook, file: OrderFile, clientId: string, filter: "all" | "ordered"): Promise<PortalShop | null> {
  const { client_name, items } = await shopItems(quotes, file, clientId);
  if (!client_name) return null;
  const counts = { all: items.length, ordered: items.filter((i) => i.ordered).length };
  return assertPortalSafe({ client_name, filter, counts, items: filter === "ordered" ? items.filter((i) => i.ordered) : items }, "the Portal's mockup shop");
}
