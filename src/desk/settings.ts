// The Desk's Settings: the rules a quote runs on, who may sign in, and what the Desk is connected to. It reports
// whether a connection is set, never a key or an address. Changing a rule lands with the database.
import { databaseConfigured, mockNelsonInUse } from "../mock/mode.ts";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import { secondFactorRequiredFromEnv, staffEmailsFromEnv } from "../surface/clerk.ts";
import { plural, rand } from "../ui/format.ts";
import type { Tone } from "../ui/bits.tsx";

type Row = { title: string; sub: string; chip: { tone: Tone; words: string } | null };
export type DeskSettings = { rules: Row[]; people: Row[]; connections: Row[] };

const on = (words = "Connected"): Row["chip"] => ({ tone: "ok", words });
const sample: Row["chip"] = { tone: "warn", words: "Sample data" };
const later = (phase: string): Row["chip"] => ({ tone: "plain", words: phase });

export function deskSettings(env: Record<string, string | undefined> = process.env): DeskSettings {
  const s = QUOTE_SETTINGS;
  const staff = staffEmailsFromEnv(env).length;
  return {
    rules: [
      { title: `A quote is valid for ${s.validityDays} days`, sub: `Check-in on day ${s.followUps.checkInDay}, a second nudge on day ${s.followUps.videoDay}, closed as no reply on day ${s.followUps.closeDay}`, chip: null },
      { title: `${s.depositPct}% deposit over ${rand(s.depositOverCents)}`, sub: "Paid in full below that", chip: null },
      { title: `${s.leadWorkingDays} working days to make`, sub: "Counted from the signed proof, until Nelson's own estimate is live", chip: null },
      { title: "Prices come from Nelson", sub: "The Desk holds no formula. A manual price needs Alan's name and a reason", chip: null },
    ],
    people: [
      { title: "Staff sign-in", sub: staff > 0 ? `${plural(staff, "address", "addresses")} on the allow-list` : "No allow-list is set", chip: staff > 0 ? on("On") : { tone: "bad", words: "Not set" } },
      { title: "Second factor", sub: "An authenticator code on every staff sign-in", chip: secondFactorRequiredFromEnv(env) ? on("On") : { tone: "warn", words: "Off until real data" } },
    ],
    connections: [
      { title: "Nelson prices", sub: "Every price, by our product code", chip: mockNelsonInUse(env) ? sample : on() },
      { title: "Database", sub: "Clients, quotes, orders, proofs", chip: databaseConfigured(env) ? on() : sample },
      { title: "Email", sub: `Quotes and updates from ${s.quotesEmail}`, chip: later("Next") },
      { title: "File storage", sub: "Artwork, proofs and signed copies, private", chip: later("Next") },
      { title: "WhatsApp", sub: "Read enquiries in, send quotes out", chip: later("Phase 4") },
      { title: "Courier", sub: "Waybills and tracking", chip: later("Phase 3") },
      { title: "Xero", sub: "Invoices and payments", chip: later("Phase 3") },
    ],
  };
}
