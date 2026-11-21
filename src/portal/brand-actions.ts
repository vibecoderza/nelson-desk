"use server";
// What a client can do to their brand kit and artwork. Each action finds the thing among the signed-in client's own
// before anything else. On mock data it says what would happen and saves nothing.
import { redirect } from "next/navigation";
import { ARTWORK_ID, KIT_ITEM_ID, type ArtworkFile } from "../brand/file.ts";
import { brandFile } from "../brand/source.ts";
import { NOTHING_SAVED, saidUrl, type Said } from "../quotes/source.ts";
import { portalClientId, portalRole } from "./who.ts";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function ownArtwork(form: FormData): Promise<ArtworkFile | null> {
  const id = text(form, "id");
  if (!ARTWORK_ID.test(id)) return null;
  return (await brandFile().artworkFor(portalClientId())).find((a) => a.id === id && a.client.id === portalClientId()) ?? null;
}
async function ownKitItem(form: FormData): Promise<{ id: string; sure: boolean; name: string } | null> {
  const id = text(form, "id");
  if (!KIT_ITEM_ID.test(id)) return null;
  const kit = await brandFile().kitFor(portalClientId());
  if (!kit || kit.client.id !== portalClientId()) return null;
  const all = [...kit.colours.map((c) => ({ id: c.id, sure: c.sure, name: c.name })), ...kit.fonts.map((f) => ({ id: f.id, sure: f.sure, name: f.name })), ...kit.rules.map((r) => ({ id: r.id, sure: r.sure, name: "That rule" }))];
  return all.find((i) => i.id === id) ?? null;
}
const back = (path: string, said: Said): never => redirect(saidUrl(path, said));

export async function askForRedraw(form: FormData): Promise<void> {
  const file = await ownArtwork(form);
  if (!file) return back("/artwork", { ok: false, text: "That file is not here." });
  if (file.check.verdict !== "needs_redraw") return back("/artwork", { ok: false, text: "That file is ready to print as it is." });
  return back("/artwork", { ok: true, text: `Nelson would redraw ${file.name} and put it under From Nelson. ${NOTHING_SAVED}` });
}

export async function confirmKitItem(form: FormData): Promise<void> {
  const item = await ownKitItem(form);
  if (!item) return back("/brand", { ok: false, text: "That is not in your brand kit." });
  if (portalRole() !== "owner") return back("/brand", { ok: false, text: "Only an Owner on your account can change the brand kit." });
  if (item.sure) return back("/brand", { ok: false, text: "That is already confirmed." });
  return back("/brand", { ok: true, text: `${item.name} would be confirmed. ${NOTHING_SAVED}` });
}
