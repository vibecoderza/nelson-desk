// Where the quote screens read from. Today that is the stand-in book; the database reader takes its place in the
// card that brings Neon in, behind the same three calls.
import { mockBook } from "../mock/book.ts";
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";
import type { QuoteBook } from "./book.ts";

export function quoteBook(): QuoteBook {
  if (mockBookInUse()) return mockBook();
  throw new NotBuiltYet("The database quote book");
}

export type Said = { ok: boolean; text: string };
export const NOTHING_SAVED = "Checked against the rules. Nothing is saved or sent yet: this is sample data.";
export const saidUrl = (path: string, said: Said) => `${path}?said=${encodeURIComponent(said.text)}${said.ok ? "" : "&refused=1"}`;
