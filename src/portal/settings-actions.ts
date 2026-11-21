"use server";
// Saving which updates reach a client, and how. Only an Owner changes settings (brief 3.6). Order updates cannot be
// switched off. On sample data it says what would be saved and saves nothing.
import { redirect } from "next/navigation";
import { NOTHING_SAVED, saidUrl } from "../quotes/source.ts";
import { UPDATE_KINDS } from "./settings.ts";
import { portalRole } from "./who.ts";

export async function saveUpdates(form: FormData): Promise<void> {
  if (portalRole() !== "owner") return redirect(saidUrl("/settings", { ok: false, text: "Only an Owner on your account can change settings." }));
  const off = UPDATE_KINDS.filter((k) => k !== "orders" && form.get(`${k}_email`) !== "on" && form.get(`${k}_whatsapp`) !== "on");
  const words = off.length === 0 ? "Every kind of update would reach you." : `You would stop getting ${off.join(" and ")} updates. Order updates always reach you.`;
  return redirect(saidUrl("/settings", { ok: true, text: `${words} ${NOTHING_SAVED}` }));
}
