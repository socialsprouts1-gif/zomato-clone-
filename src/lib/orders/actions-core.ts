import "server-only";

import { transition, type Actor } from "./state-machine";

/** Accept = ACCEPTED (with prep time) then straight into PREPARING. */
export async function acceptOrder(orderId: string, prepMinutes: number, actor: Actor, note?: string) {
  await transition(orderId, "ACCEPTED", actor, { patch: { prep_minutes: prepMinutes }, note: note ?? `Prep time ${prepMinutes} min` });
  return transition(orderId, "PREPARING", actor);
}
