import type { ReactNode } from "react";

/**
 * Player progression is already rendered by ProfileAchievements.
 * Keep this compatibility component so older imports do not create a
 * duplicate Player Card on the profile.
 */
export function ProfilePlayerCard(): ReactNode {
  return null;
}
