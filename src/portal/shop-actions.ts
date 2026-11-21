"use server";
// Ordering a piece again from the mockup shop. The piece is found among the signed-in client's own before anything
// else. It never orders or prices anything itself: it opens a quote, and Nelson prices that.
import { redirect } from "next/navigation";
import { orderFile } from "../orders/source.ts";
import { NOTHING_SAVED, quoteBook, saidUrl, type Said } from "../quotes/source.ts";
import { SHOP_ITEM_ID, shopItems, type ShopItem } from "./shop.ts";
import { portalClientId } from "./who.ts";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function ownItem(form: FormData): Promise<ShopItem | null> {
  const id = text(form, "id");
  if (!SHOP_ITEM_ID.test(id)) return null;
  return (await shopItems(quoteBook(), orderFile(), portalClientId())).items.find((i) => i.id === id) ?? null;
}
const back = (said: Said): never => redirect(saidUrl("/shop", said));

export async function orderAgain(form: FormData): Promise<void> {
  const item = await ownItem(form);
  if (!item) return back({ ok: false, text: "That piece is not in your shop." });
  const typed = text(form, "quantity");
  const quantity = /^\d{1,6}$/.test(typed) ? Number(typed) : 0;
  if (quantity < 1) return back({ ok: false, text: "Type how many you need." });
  return back({ ok: true, text: `A quote would open for ${quantity} × ${item.name}, with your artwork as it was. Nelson prices it at that quantity. ${NOTHING_SAVED}` });
}
