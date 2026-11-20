// Every state machine answers the same way: the next state, or the reason the move is refused.
export type Ok<T> = { ok: true; value: T };
export type Refused = { ok: false; code: string; reason: string };
export type Result<T> = Ok<T> | Refused;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const refuse = (code: string, reason: string): Refused => ({ ok: false, code, reason });

// Who is asking. "auto" is a webhook or a timer; "staff" is a click on the Desk; "client" is a click on the Portal.
export type Actor = "auto" | "staff" | "client";
