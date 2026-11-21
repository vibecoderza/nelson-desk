// HMAC-SHA256 over "<timestamp>.<raw body>", five-minute tolerance (brief 6.6).
// The secret is DESK_WEBHOOK_SECRET. It is passed in; this module never reads the environment.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-nelson-signature";
export const TOLERANCE_SECONDS = 300;

const mac = (secret: string, timestamp: number, rawBody: string) => createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

export function sign(rawBody: string, secret: string, now: Date): string {
  if (!secret) throw new Error("no signing secret");
  const t = Math.floor(now.getTime() / 1000);
  return `t=${t},v1=${mac(secret, t, rawBody)}`;
}

export type Verified = { ok: true } | { ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" | "no_secret" };

export function verify(rawBody: string, header: string | null | undefined, secret: string, now: Date): Verified {
  if (!secret) return { ok: false, reason: "no_secret" }; // fail closed: an unset secret verifies nothing
  if (!header) return { ok: false, reason: "missing" };
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header);
  if (!m) return { ok: false, reason: "malformed" };
  const t = Number(m[1]);
  if (Math.abs(Math.floor(now.getTime() / 1000) - t) > TOLERANCE_SECONDS) return { ok: false, reason: "stale" };
  const expected = Buffer.from(mac(secret, t, rawBody), "hex");
  const given = Buffer.from(m[2]!, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given) ? { ok: true } : { ok: false, reason: "mismatch" };
}
