// What the Portal's Brand kit and Artwork screens show: one client's own kit and files, each passed through the
// exposure walk before it is returned. A client with nothing on file gets an empty page, never another client's.
import { assertPortalSafe } from "../exposure/private.ts";
import type { ArtworkFile, BrandFile } from "../brand/file.ts";
import { day } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";

type KitItem = { id: string; title: string; sub: string; tiles: string[]; sure: boolean };
export type PortalBrandKit = { client_name: string; read: string | null; may_confirm: boolean; guesses: number; colours: KitItem[]; fonts: KitItem[]; rules: KitItem[] };

export async function portalBrandKit(file: BrandFile, clientId: string, clientName: string, mayConfirm: boolean): Promise<PortalBrandKit> {
  const kit = await file.kitFor(clientId);
  if (!kit || kit.client.id !== clientId) return assertPortalSafe({ client_name: clientName, read: null, may_confirm: mayConfirm, guesses: 0, colours: [], fonts: [], rules: [] }, "the Portal's empty brand kit");
  const colours = kit.colours.map((c) => ({ id: c.id, title: c.name, sub: `${c.hex.toUpperCase()} · nearest thread: ${c.thread}`, tiles: [c.hex], sure: c.sure }));
  const fonts = kit.fonts.map((f) => ({ id: f.id, title: f.name, sub: f.use, tiles: [], sure: f.sure }));
  const rules = kit.rules.map((r) => ({ id: r.id, title: r.words, sub: "", tiles: [], sure: r.sure }));
  return assertPortalSafe({
    client_name: clientName, read: `Read from your ${kit.read_from.charAt(0).toLowerCase()}${kit.read_from.slice(1)} on ${day(kit.read_at)}`, may_confirm: mayConfirm,
    guesses: [...colours, ...fonts, ...rules].filter((i) => !i.sure).length, colours, fonts, rules,
  }, "the Portal's brand kit");
}

export type ArtworkRow = { id: string; name: string; sub: string; tiles: string[]; chip: { tone: Tone; words: string }; can_redraw: boolean };
export type PortalArtwork = { client_name: string; yours: ArtworkRow[]; from_nelson: ArtworkRow[] };

const checkWords = (a: ArtworkFile) =>
  [a.check.kind === "vector" ? "Vector · prints sharp at any size" : `Pixels · prints sharp up to ${a.check.sharp_to_mm} mm wide`, `${a.check.colours} ${a.check.colours === 1 ? "colour" : "colours"}`, `added ${day(a.added_at)}`].join(" · ");

export async function portalArtwork(file: BrandFile, clientId: string, clientName: string): Promise<PortalArtwork> {
  const files = (await file.artworkFor(clientId)).filter((a) => a.client.id === clientId).sort((a, b) => b.added_at.getTime() - a.added_at.getTime());
  const redrawn = new Set(files.map((a) => a.redraw_of).filter(Boolean));
  const row = (a: ArtworkFile): ArtworkRow => {
    const done = redrawn.has(a.id);
    const needs = a.check.verdict === "needs_redraw" && !done;
    return { id: a.id, name: a.name, sub: checkWords(a), tiles: a.tiles, chip: needs ? { tone: "warn", words: "Needs a redraw" } : done ? { tone: "plain", words: "Redrawn" } : { tone: "ok", words: "Ready to print" }, can_redraw: needs };
  };
  return assertPortalSafe({ client_name: clientName, yours: files.filter((a) => a.from === "client").map(row), from_nelson: files.filter((a) => a.from === "nelson").map(row) }, "the Portal's artwork");
}
