// ---------------------------------------------------------------------------
// pusher.ts — Pusher server-side helper (lazy init)
// Env vars necessárias: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
// ---------------------------------------------------------------------------

let _pusher: import("pusher").default | null = null;

function getPusher() {
  if (_pusher) return _pusher;
  const appId = process.env["PUSHER_APP_ID"];
  const key = process.env["PUSHER_KEY"];
  const secret = process.env["PUSHER_SECRET"];
  const cluster = process.env["PUSHER_CLUSTER"] ?? "mt1";
  if (!appId || !key || !secret) return null;
  const Pusher = require("pusher") as typeof import("pusher").default;
  _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return _pusher;
}

export type BeyondEvent =
  | { event: "new-application"; data: { artistName: string; email: string } }
  | { event: "new-donation"; data: { artistName: string; amount: number; workSlug: string } }
  | { event: "new-comment"; data: { workSlug: string; author: string } }
  | { event: "work-submitted"; data: { title: string; artistName: string } };

export async function pushEvent(payload: BeyondEvent): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return; // Pusher não configurado — silently skip
  try {
    await pusher.trigger("beyond-admin", payload.event, payload.data);
  } catch {
    // Não deixar falha de Pusher quebrar a request principal
  }
}
