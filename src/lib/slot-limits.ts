/** Canonical client-side slot bet policy used by all slot UIs. Server RPCs remain authoritative. */

import type { AppRole } from "@/lib/auth";
import { PRIVILEGED_MAX_BET, STANDARD_MAX_BET } from "@/lib/slots";

/** Roles that unlock the extended slot bet ladder. Mirrors the server-side has_role() checks. */
export const HIGH_ROLLER_ROLES: AppRole[] = ["high_roller", "admin"];

export function isPrivilegedSlotPlayer(roles: readonly AppRole[] | null | undefined): boolean {
  return (roles ?? []).some((role) => HIGH_ROLLER_ROLES.includes(role));
}

export function getSlotMaxBet(roles: readonly AppRole[] | null | undefined): number {
  return isPrivilegedSlotPlayer(roles) ? PRIVILEGED_MAX_BET : STANDARD_MAX_BET;
}
