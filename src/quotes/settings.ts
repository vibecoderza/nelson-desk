// Settings the quote screens read. Each one is Alan's number (brief section 9); these are the recommended defaults
// until the Settings screen holds them. None of them is a price.
import { DEFAULT_FOLLOW_UPS } from "../domain/quote.ts";

export const QUOTE_SETTINGS = {
  followUps: DEFAULT_FOLLOW_UPS, // decision 4: day 3, day 7, close at day 10
  validityDays: 14, // decision 4
  depositOverCents: 2_000_000, // decision 5: 50% deposit over R 20 000, in full below
  depositPct: 50,
  leadWorkingDays: 7, // decision 6: one flat default, from the signed proof
  staffContact: "Alan",
  quotesEmail: "quotes@dearnelson.co.za",
} as const;
