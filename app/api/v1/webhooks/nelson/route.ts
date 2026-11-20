// Nelson to Desk events (contract: postEventToDesk). Guarded by the HMAC signature, not by a session.
import { receiveNelsonEvent } from "@/backbone/inbox";
import { deskDb } from "@/db";
import { SIGNATURE_HEADER } from "@/events/signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const received = await receiveNelsonEvent(deskDb, {
    rawBody,
    signature: req.headers.get(SIGNATURE_HEADER),
    secret: process.env.DESK_WEBHOOK_SECRET ?? "", // unset verifies nothing: every event is refused
    now: new Date(),
  });
  const body = received.status === 202 ? { ok: true, duplicate: received.duplicate } : { error: received.status === 401 ? "bad_signature" : "invalid_event" };
  return Response.json(body, { status: received.status, headers: { "cache-control": "no-store" } });
}
