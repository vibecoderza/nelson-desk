// Nothing exposed (North Star 3.10). What may never reach the Portal, the PDF or a client message.
// The lists mirror Nelson's public-spec.js. This module is the Desk's own copy of the wall, not of any price logic.

// A key that names what we pay, our mark-up, a supplier, stock levels or the staff block never leaves the Desk,
// wherever it sits in a document.
export const PRIVATE_KEY = /(^|_)(staff|cost|costs|margin|markup|mark_up|supplier|tier|price_book|book|sell_rule|sell_note|warehouse|stock|incoming_stock)(_|$)/i;
// Keys that match the pattern and are safe on purpose. Add here deliberately, with the reason.
const KEY_OK = new Set<string>([
  "book_hex", // the colour book's hex: a colour, not a price book
]);

// Customer copy never names a supplier.
export const SUPPLIER_NAMES = /\b(amrod|kmq|captivity|headwear\s?24|h24|barron|twentyfour(?:\.store)?)\b/i;
// No public string may point at a supplier's servers.
export const SUPPLIER_HOSTS = /\b(?:[a-z0-9-]+\.)*(?:amrod|amrcdn|kmq|captivity|twentyfour|headwear24|barron)\.(?:co\.za|com|store|net)\b/i;
// A supplier's order reference, as on the Desk's supply chain panel.
export const SUPPLIER_REF = /\bSO-\d{4,}\b/;

export type Leak = { path: string; kind: "private_key" | "supplier_name" | "supplier_host" | "supplier_ref"; value: string };

// Walks any JSON-like value and reports everything private in it. An empty list means the value may go to a client.
export function leaksIn(value: unknown, path = "$"): Leak[] {
  const leaks: Leak[] = [];
  if (typeof value === "string") {
    if (SUPPLIER_HOSTS.test(value)) leaks.push({ path, kind: "supplier_host", value });
    else if (SUPPLIER_NAMES.test(value)) leaks.push({ path, kind: "supplier_name", value });
    if (SUPPLIER_REF.test(value)) leaks.push({ path, kind: "supplier_ref", value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => leaks.push(...leaksIn(v, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (PRIVATE_KEY.test(k) && !KEY_OK.has(k)) leaks.push({ path: `${path}.${k}`, kind: "private_key", value: k });
      leaks.push(...leaksIn(v, `${path}.${k}`));
    }
  }
  return leaks;
}

// The same walk over rendered HTML or any text a client receives.
export function leaksInText(text: string, path = "text"): Leak[] {
  const leaks: Leak[] = [];
  const host = text.match(SUPPLIER_HOSTS);
  if (host) leaks.push({ path, kind: "supplier_host", value: host[0] });
  const name = text.replace(new RegExp(SUPPLIER_HOSTS.source, "gi"), "").match(SUPPLIER_NAMES);
  if (name) leaks.push({ path, kind: "supplier_name", value: name[0] });
  const ref = text.match(SUPPLIER_REF);
  if (ref) leaks.push({ path, kind: "supplier_ref", value: ref[0] });
  return leaks;
}

// The last gate before anything is sent to a client. Throws; it never strips. A leak is a bug to fix at the source.
export function assertPortalSafe<T>(value: T, what: string): T {
  const leaks = leaksIn(value);
  if (leaks.length) throw new Error(`${what} would expose ${leaks.map((l) => `${l.kind} at ${l.path}`).join(", ")}`);
  return value;
}
