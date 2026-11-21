// The official quote document (brief 5.1). Made from a sent version, never typed. It goes to the client, so it is
// built from the customer view only and checked before it is returned: no supplier, no cost, no margin.
import { assertPortalSafe } from "../exposure/private.ts";
import { versionOf, latestVersion, type BookQuote } from "./book.ts";
import { QUOTE_SETTINGS } from "./settings.ts";

export type QuoteDocument = {
  ref: string; version: number; dated: Date; valid_until: Date | null;
  for: { company: string; person: string; address: string };
  from: { company: string; email: string };
  items: { name: string; detail: string; quantity: number; each_cents: number | null; amount_cents: number | null }[];
  total_cents: number;
  terms: string;
  accept: string[];
  versions: number[];
};

export function quoteDocument(quote: BookQuote, wanted?: number): QuoteDocument | null {
  const v = wanted ? versionOf(quote, wanted) : latestVersion(quote);
  if (!v) return null; // a draft has no document: nothing has been sent
  const deposit = v.totals.total_cents > QUOTE_SETTINGS.depositOverCents;
  const items: QuoteDocument["items"] = v.lines.map((l) => ({ name: `${l.product_name} · ${l.colour}`, detail: l.decoration_words, quantity: l.quantity, each_cents: l.unit_cents, amount_cents: l.line_total_cents }));
  if (v.totals.setup_cents > 0) items.push({ name: "Setup", detail: "Once per design", quantity: 1, each_cents: v.totals.setup_cents, amount_cents: v.totals.setup_cents });
  items.push({ name: "Delivery", detail: v.delivery_words, quantity: 1, each_cents: v.totals.delivery_cents, amount_cents: v.totals.delivery_cents });
  return assertPortalSafe({
    ref: quote.ref, version: v.version, dated: v.sent_at, valid_until: quote.valid_until,
    for: { company: quote.client.name, person: quote.client.contact_name, address: quote.client.address_words },
    from: { company: "Nelson", email: QUOTE_SETTINGS.quotesEmail },
    items, total_cents: v.totals.total_cents,
    terms: `Free proof before anything is made. Delivery in ${QUOTE_SETTINGS.leadWorkingDays} working days from the signed proof. ${deposit ? `${QUOTE_SETTINGS.depositPct}% deposit to start, the balance before dispatch.` : "Payment in full to start."}`,
    accept: ["Online in your portal: my.dearnelson.co.za", `Or EFT, using ${quote.ref} as the reference.`],
    versions: quote.versions.map((x) => x.version),
  }, `the official quote ${quote.ref}`);
}
