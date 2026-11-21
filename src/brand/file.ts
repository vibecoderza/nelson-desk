// A client's brand kit and artwork as the screens read them (brief 3.7): the customer view only. The stand-in file
// today, the database tables (`brand_kit`, `brand_colour`, `brand_font`, `brand_rule`, `artwork_file`) later, behind
// the same two calls.
export type BrandColour = { id: string; name: string; hex: string; thread: string; sure: boolean };
export type BrandFont = { id: string; name: string; use: string; sure: boolean };
export type BrandRule = { id: string; words: string; sure: boolean };
export type BrandKit = { id: string; client: { id: string; name: string }; read_from: string; read_at: Date; colours: BrandColour[]; fonts: BrandFont[]; rules: BrandRule[] };

export type ArtworkCheck = { kind: "vector" | "pixels"; sharp_to_mm: number | null; colours: number; verdict: "ready" | "needs_redraw" };
export type ArtworkFile = { id: string; client: { id: string; name: string }; name: string; from: "client" | "nelson"; added_at: Date; check: ArtworkCheck; tiles: string[]; redraw_of: string | null };

export type BrandFile = {
  kitFor(clientId: string): Promise<BrandKit | null>;
  artworkFor(clientId: string): Promise<ArtworkFile[]>;
};

export const ARTWORK_ID = /^af_[a-z0-9_]{1,40}$/;
export const KIT_ITEM_ID = /^(bc|bf|br)_[a-z0-9_]{1,40}$/;
