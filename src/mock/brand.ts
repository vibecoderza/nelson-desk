// Stand-in brand kits and artwork. Sample data: invented colours, fonts, rules and file names, so the Brand kit and
// Artwork screens can be walked before the reader and the artwork check exist. No client's real brand is in here.
import type { ArtworkFile, BrandFile, BrandKit } from "../brand/file.ts";
import { CLIENTS } from "./book.ts";

const who = (c: { id: string; name: string }) => ({ id: c.id, name: c.name });
const at = (iso: string) => new Date(iso);

export function mockKits(): BrandKit[] {
  return [
    {
      id: "bk_moon", client: who(CLIENTS.moon), read_from: "Brand guide (PDF)", read_at: at("2026-11-04T09:10:00Z"),
      summary: { words: "Herbal teas and rituals, made by hand. Calm, earthy and warm; natural textures, soft colour, nothing loud.", sure: false },
      colours: [
        { id: "bc_moon_1", name: "Moss", hex: "#4B5D43", thread: "Deep moss green", sure: true },
        { id: "bc_moon_2", name: "Clay", hex: "#B5694A", thread: "Burnt terracotta", sure: true },
        { id: "bc_moon_3", name: "Oat", hex: "#EADFCB", thread: "Natural ecru", sure: true },
        { id: "bc_moon_4", name: "Night", hex: "#23262B", thread: "Soft black", sure: false },
      ],
      fonts: [
        { id: "bf_moon_1", name: "Cormorant Garamond", use: "Headings", sure: true },
        { id: "bf_moon_2", name: "Karla", use: "Body", sure: false },
      ],
      rules: [
        { id: "br_moon_1", words: "Keep clear space around the logo equal to the height of the moon.", sure: true },
        { id: "br_moon_2", words: "The logo is one colour only: Moss, Night or Oat.", sure: true },
        { id: "br_moon_3", words: "Never smaller than 20 mm wide.", sure: false },
      ],
    },
    {
      id: "bk_lagom", client: who(CLIENTS.lagom), read_from: "Website", read_at: at("2026-11-12T14:00:00Z"), summary: null,
      colours: [{ id: "bc_lagom_1", name: "Ink", hex: "#111111", thread: "Black", sure: true }, { id: "bc_lagom_2", name: "Paper", hex: "#F5F2EC", thread: "Off white", sure: false }],
      fonts: [{ id: "bf_lagom_1", name: "Inter", use: "Everything", sure: false }],
      rules: [],
    },
  ];
}

export function mockArtwork(): ArtworkFile[] {
  const moon = who(CLIENTS.moon);
  return [
    { id: "af_moon_1", tag: "logo", main: true, client: moon, name: "mother-moon-logo.svg", from: "client", added_at: at("2026-11-04T09:05:00Z"), check: { kind: "vector", sharp_to_mm: null, colours: 1, verdict: "ready" }, tiles: ["#4B5D43"], redraw_of: null },
    { id: "af_moon_2", tag: "pattern", main: false, client: moon, name: "moon-botanical-stamp.png", from: "client", added_at: at("2026-11-10T16:40:00Z"), check: { kind: "pixels", sharp_to_mm: 45, colours: 3, verdict: "needs_redraw" }, tiles: ["#B5694A", "#EADFCB"], redraw_of: null },
    { id: "af_moon_3", tag: "logo", main: false, client: moon, name: "ritual-wordmark.jpg", from: "client", added_at: at("2026-10-28T08:20:00Z"), check: { kind: "pixels", sharp_to_mm: 30, colours: 2, verdict: "needs_redraw" }, tiles: ["#23262B"], redraw_of: null },
    { id: "af_moon_4", tag: "logo", main: false, client: moon, name: "ritual-wordmark-redrawn.svg", from: "nelson", added_at: at("2026-10-30T11:00:00Z"), check: { kind: "vector", sharp_to_mm: null, colours: 1, verdict: "ready" }, tiles: ["#23262B"], redraw_of: "af_moon_3" },
    { id: "af_lagom_1", tag: "logo", main: true, client: who(CLIENTS.lagom), name: "lagom-mark.svg", from: "client", added_at: at("2026-11-12T14:05:00Z"), check: { kind: "vector", sharp_to_mm: null, colours: 1, verdict: "ready" }, tiles: ["#111111"], redraw_of: null },
  ];
}

export function mockBrand(): BrandFile {
  return {
    kitFor: async (clientId) => mockKits().find((k) => k.client.id === clientId) ?? null,
    artworkFor: async (clientId) => mockArtwork().filter((a) => a.client.id === clientId),
  };
}
