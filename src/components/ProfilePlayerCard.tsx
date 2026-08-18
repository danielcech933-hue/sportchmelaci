import type { ReactNode } from "react";

type ProfilePlayerCardProps = {
  nickname?: string | null;
  stats?: unknown;
};

/**
 * Player progression is already rendered by ProfileAchievements.
 * Keep this compatibility component so older imports do not create a
 * duplicate Player Card on the profile.
 */
export function ProfilePlayerCard(_props: ProfilePlayerCardProps = {}): ReactNode {
  return null;
}
