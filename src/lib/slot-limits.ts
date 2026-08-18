/** Canonical client-side slot bet policy used by all slot UIs. Server RPCs remain authoritative. */

import { PRIVILEGED_MAX_BET, STANDARD_MAX_BET } from "@/lib/slots";

const PRIVILEGED_SLOT_PLAYERS = new Set([
  "danko",
  "chlaďar",
  "chladar",
  "midas",
  "m1das",
  "messi",
  "mesi",
]);

export function normalizeSlotPlayerName(name: string): string {
  return name.trim().toLocaleLowerCase("cs-CZ");
}

export function isPrivilegedSlotPlayer(name: string): boolean {
  return PRIVILEGED_SLOT_PLAYERS.has(normalizeSlotPlayerName(name));
}

export function getSlotMaxBet(name: string): number {
  return isPrivilegedSlotPlayer(name) ? PRIVILEGED_MAX_BET : STANDARD_MAX_BET;
}

export { PRIVILEGED_SLOT_PLAYERS };
