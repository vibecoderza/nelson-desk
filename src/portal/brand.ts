// What the Portal's Brand kit and Artwork screens show: one client's own kit and files, each passed through the
// exposure walk before it is returned. A client with nothing on file gets an empty page, never another client's.
import { assertPortalSafe } from "../exposure/private.ts";
import { ARTWORK_TAGS, type ArtworkFile, type ArtworkTag, type BrandFile } from "../brand/file.ts";
import type { SiteRead } from "../brand/read-site.ts";
import { nearestThread } from "../brand/threads.ts";
import { day } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";

type KitItem = { id: string; title: string; sub: string; tiles: string[]; sure: boolean };
export type PortalBrandKit = {
  client_name: string; read: string | null; draft: boolean; may_confirm: boolean; guesses: number;
  summary: { id: string; words: string; sure: boolean } | null; logos: string[]; colours: KitItem[]; fonts: KitItem[]; rules: KitItem[];
};

const EMPTY = { read: null, draft: false, guesses: 0, summary: null, logos: [], colours: [], fonts: [], rules: [] };
const FONT_USE = ["Headings", "Body"];

export async function portalBrandKit(file: BrandFile, clientId: string, clientName: string, mayConfirm: boolean): Promise<PortalBrandKit> {
  const kit = await file.kitFor(clientId);
  if (!kit || kit.client.id !== clientId) return assertPortalSafe({ client_name: clientName, may_confirm: mayConfirm, ...EMPTY }, "the Portal's empty brand kit");
  const colours = kit.colours.map((c) => ({ id: c.id, title: c.name, sub: `${c.hex.toUpperCase()} · nearest thread: ${c.thread}`, tiles: [c.hex], sure: c.sure }));
  const fonts = kit.fonts.map((f) => ({ id: f.id, title: f.name, sub: f.use, tiles: [], sure: f.sure }));
  const rules = kit.rules.map((r) => ({ id: r.id, title: r.words, sub: "", tiles: [], sure: r.sure }));
  const summary = kit.summary ? { id: "bs_summary", words: kit.summary.words, sure: kit.summary.sure } : null;
  return assertPortalSafe({
    client_name: clientName, read: `Read from your ${kit.read_from.charAt(0).toLowerCase()}${kit.read_from.slice(1)} on ${day(kit.read_at)}`, draft: false, may_confirm: mayConfirm,
    guesses: [...colours, ...fonts, ...rules, ...(summary ? [summary] : [])].filter((i) => !i.sure).length, summary, logos: [], colours, fonts, rules,
  }, "the Portal's brand kit");
}

// A kit as just read from a website. Every line of it is a guess until the client confirms it.
export function portalSiteKit(host: string, read: SiteRead, logos: string[], clientName: string): PortalBrandKit {
  const colours = read.colours.map((hex, i) => ({ id: `bc_read_${i}`, title: hex, sub: `nearest thread: ${nearestThread(hex)}`, tiles: [hex], sure: false }));
  const fonts = read.fonts.map((name, i) => ({ id: `bf_read_${i}`, title: name, sub: FONT_USE[i] ?? "", tiles: [], sure: false }));
  const summary = read.summary ? { id: "bs_read", words: read.summary, sure: false } : null;
  return assertPortalSafe({
    client_name: clientName, read: `Read from ${host} just now`, draft: true, may_confirm: false,
    guesses: colours.length + fonts.length + (summary ? 1 : 0), summary, logos, colours, fonts, rules: [],
  }, "the Portal's brand kit as read from a website");
}

export type ArtworkFilter = "all" | ArtworkTag;
export type ArtworkRow = { id: string; name: string; sub: string; tiles: string[]; chip: { tone: Tone; words: string }; main: boolean; can_redraw: boolean; can_be_main: boolean };
export type PortalArtwork = { client_name: string; filter: ArtworkFilter; filters: { value: ArtworkFilter; label: string; count: number }[]; total: number; yours: ArtworkRow[]; from_nelson: ArtworkRow[] };

const TAG_WORDS: Record<ArtworkTag, [string, string]> = { logo: ["Logo", "Logos"], icon: ["Icon", "Icons"], pattern: ["Pattern", "Patterns"], photo: ["Photo", "Photos"] };
const checkWords = (a: ArtworkFile) =>
  [TAG_WORDS[a.tag][0], a.check.kind === "vector" ? "vector, sharp at any size" : `pixels, sharp up to ${a.check.sharp_to_mm} mm wide`, `${a.check.colours} ${a.check.colours === 1 ? "colour" : "colours"}`].join(" · ");
export const artworkFilter = (typed: unknown): ArtworkFilter => (ARTWORK_TAGS as readonly unknown[]).includes(typed) ? (typed as ArtworkTag) : "all";

export async function portalArtwork(file: BrandFile, clientId: string, clientName: string, filter: ArtworkFilter = "all"): Promise<PortalArtwork> {
  const files = (await file.artworkFor(clientId)).filter((a) => a.client.id === clientId).sort((a, b) => Number(b.main) - Number(a.main) || b.added_at.getTime() - a.added_at.getTime());
  const redrawn = new Set(files.map((a) => a.redraw_of).filter(Boolean));
  const row = (a: ArtworkFile): ArtworkRow => {
    const done = redrawn.has(a.id);
    const needs = a.check.verdict === "needs_redraw" && !done;
    return {
      id: a.id, name: a.name, sub: checkWords(a), tiles: a.tiles, main: a.main, can_redraw: needs, can_be_main: a.tag === "logo" && !a.main && a.check.verdict === "ready",
      chip: needs ? { tone: "warn", words: "Needs a redraw" } : done ? { tone: "plain", words: "Redrawn" } : { tone: "ok", words: "Ready to print" },
    };
  };
  const shown = files.filter((a) => filter === "all" || a.tag === filter);
  const filters = [{ value: "all" as ArtworkFilter, label: "All", count: files.length }, ...ARTWORK_TAGS.map((t) => ({ value: t as ArtworkFilter, label: TAG_WORDS[t][1], count: files.filter((a) => a.tag === t).length })).filter((f) => f.count > 0)];
  return assertPortalSafe({ client_name: clientName, filter, filters, total: files.length, yours: shown.filter((a) => a.from === "client").map(row), from_nelson: shown.filter((a) => a.from === "nelson").map(row) }, "the Portal's artwork");
}
