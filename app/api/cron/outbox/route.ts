// The outbox worker, run by Vercel Cron every minute (vercel.json). Guarded by CRON_SECRET, which Vercel sends as
// a bearer token.
import { timingSafeEqual } from "node:crypto";
import { drain, nelsonEventHandler, type Handlers } from "@/backbone/outbox";
import { deskDb } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("Not found", { status: 404 });
  const handlers: Handlers = {};
  const { NELSON_BASE_URL: baseUrl, DESK_WEBHOOK_SECRET: webhookSecret } = process.env;
  if (baseUrl && webhookSecret) handlers.nelson_event = nelsonEventHandler({ baseUrl, webhookSecret });
  // notify (email, WhatsApp) and xero handlers join here in their own phases. Until then their rows wait.
  const result = await drain(deskDb(), handlers, new Date());
  return Response.json({ sent: result.sent.length, retrying: result.retrying.length, failed: result.failed.length }, { headers: { "cache-control": "no-store" } });
}
