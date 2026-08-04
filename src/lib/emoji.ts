/**
 * Dynamic "AI × Sport" emoji generator.
 * Deterministic per key (same player always gets the same combo) but creative:
 * blends athletics, tech/AI and achievement glyphs for a futuristic esports vibe.
 */

const ATHLETIC = ["🏅", "🥇", "🏆", "⚡", "🔥", "💪", "🎯", "🏟️", "🥊", "🛡️", "🚀", "🎽"];
const TECH = ["🤖", "🧠", "🛸", "💾", "📡", "🕹️", "🔮", "⚙️", "🧬", "💠", "🌐", "🔋"];
const AURA = ["✨", "💫", "🌀", "⭐", "☄️", "🎆", "🪩", "🔆"];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(list: T[], seed: number, salt = 0): T {
  return list[(seed + salt * 7919) % list.length];
}

/** Two-glyph signature for a player / team name, e.g. "🧠⚡". */
export function playerEmoji(name: string | null | undefined): string {
  if (!name) return "🤖";
  const seed = hash(name.trim().toLowerCase());
  return `${pick(TECH, seed)}${pick(ATHLETIC, seed, 3)}`;
}

/** Extra sparkle used for hot streaks / high win-rates. */
export function auraEmoji(name: string | null | undefined, intensity = 0): string {
  if (intensity <= 0) return "";
  const seed = hash((name ?? "x") + ":aura");
  return pick(AURA, seed, intensity);
}

const RANK_EMOJI = ["🥇👑", "🥈🛰️", "🥉🔥"];

/** Rank badge glyphs — top 3 get medals, everyone else a deterministic combo. */
export function rankEmoji(rank: number, name?: string): string {
  if (rank >= 1 && rank <= 3) return RANK_EMOJI[rank - 1];
  return playerEmoji(name ?? `rank-${rank}`);
}

const STAT_EMOJI: Record<string, string> = {
  matches: "🎮📊",
  wins: "🏆⚡",
  losses: "💀📉",
  solo: "🧍🧠",
  team: "🤝🛰️",
  winrate: "📈🔮",
  bets: "🎰🤖",
  money: "💸💠",
  elo: "🧬📡",
  streak: "🔥🚀",
};

export function statEmoji(kind: keyof typeof STAT_EMOJI | string): string {
  return STAT_EMOJI[kind] ?? "✨";
}
