import { supabase } from "@/integrations/supabase/client";
import type {
  Rarity,
  UtCard,
  UtClub,
  UtOwnedCard,
  UtSpinResult,
  UtSpinType,
} from "@/types/ut";

/* ---------- vizuální meta rarit ---------- */

export const RARITY_ORDER: Rarity[] = [
  "COMMON",
  "RARE",
  "SUPER_RARE",
  "SPECIAL",
  "EVENT",
  "HERO",
  "UNIQUE",
  "ICON",
  "LEGENDARY",
];

export const RARITY_META: Record<
  Rarity,
  { label: string; frame: string; glow: string; text: string; accent: string; walkout: boolean }
> = {
  COMMON: {
    label: "Common",
    frame: "border-zinc-400/50 bg-gradient-to-b from-zinc-300/15 via-zinc-600/10 to-zinc-950/50",
    glow: "shadow-[0_0_18px_-8px_rgba(212,212,216,0.5)]",
    text: "text-zinc-100",
    accent: "text-zinc-300",
    walkout: false,
  },
  RARE: {
    label: "Rare",
    frame: "border-amber-300/70 bg-gradient-to-b from-amber-200/25 via-amber-500/10 to-amber-950/50",
    glow: "shadow-[0_0_26px_-7px_rgba(251,191,36,0.6)]",
    text: "text-amber-100",
    accent: "text-amber-300",
    walkout: false,
  },
  SUPER_RARE: {
    label: "Super Rare",
    frame: "border-slate-100/70 bg-gradient-to-b from-slate-700/70 via-slate-900/80 to-black",
    glow: "shadow-[0_0_30px_-5px_rgba(226,232,240,0.6)]",
    text: "text-slate-50",
    accent: "text-slate-200",
    walkout: false,
  },
  SPECIAL: {
    label: "Special",
    frame: "border-fuchsia-300/70 bg-gradient-to-b from-fuchsia-400/25 via-purple-700/25 to-indigo-950/60",
    glow: "shadow-[0_0_32px_-4px_rgba(232,121,249,0.7)]",
    text: "text-fuchsia-50",
    accent: "text-fuchsia-200",
    walkout: true,
  },
  EVENT: {
    label: "Event",
    frame: "border-cyan-300/70 bg-gradient-to-b from-cyan-300/25 via-sky-700/25 to-slate-950/70",
    glow: "shadow-[0_0_34px_-4px_rgba(103,232,249,0.7)]",
    text: "text-cyan-50",
    accent: "text-cyan-200",
    walkout: true,
  },
  HERO: {
    label: "Hero",
    frame: "border-orange-300/80 bg-gradient-to-b from-orange-300/30 via-rose-700/25 to-zinc-950/70",
    glow: "shadow-[0_0_36px_-4px_rgba(253,186,116,0.75)]",
    text: "text-orange-50",
    accent: "text-orange-200",
    walkout: true,
  },
  UNIQUE: {
    label: "Unique",
    frame: "border-emerald-300/80 bg-gradient-to-b from-emerald-300/25 via-teal-700/25 to-slate-950/70",
    glow: "shadow-[0_0_36px_-4px_rgba(110,231,183,0.75)]",
    text: "text-emerald-50",
    accent: "text-emerald-200",
    walkout: true,
  },
  ICON: {
    label: "Icon",
    frame: "border-zinc-50/80 bg-gradient-to-b from-zinc-100/35 via-zinc-400/20 to-zinc-950/70",
    glow: "shadow-[0_0_40px_-3px_rgba(250,250,250,0.85)]",
    text: "text-zinc-50",
    accent: "text-white",
    walkout: true,
  },
  LEGENDARY: {
    label: "Legendary",
    frame: "border-yellow-200/90 bg-gradient-to-b from-yellow-200/35 via-amber-600/25 to-black",
    glow: "shadow-[0_0_46px_-2px_rgba(253,224,71,0.9)]",
    text: "text-yellow-50",
    accent: "text-yellow-200",
    walkout: true,
  },
};

export function rarityMeta(r: string) {
  return RARITY_META[(r as Rarity) ?? "COMMON"] ?? RARITY_META.COMMON;
}

/* ---------- mapování ---------- */

type CardRow = {
  id: string;
  key: string;
  name: string;
  rating: number;
  position: string;
  alt_positions: string[] | null;
  nation: string;
  club: string;
  league: string;
  rarity: string | null;
  campaign: string | null;
  card_type: string;
  image_url: string | null;
  playstyles: string[] | null;
  playstyles_plus: string[] | null;
  roles: string[] | null;
  quick_sell: number | null;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  attrs: Record<string, number> | null;
};

export function toUtCard(r: CardRow): UtCard {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    rating: r.rating,
    position: r.position,
    altPositions: r.alt_positions ?? [],
    nation: r.nation,
    club: r.club,
    league: r.league,
    rarity: ((r.rarity as Rarity) ?? "COMMON") as Rarity,
    campaign: r.campaign,
    cardType: r.card_type,
    imageUrl: r.image_url,
    playstyles: r.playstyles ?? [],
    playstylesPlus: r.playstyles_plus ?? [],
    roles: r.roles ?? [],
    quickSell: r.quick_sell ?? 100,
    pac: r.pac,
    sho: r.sho,
    pas: r.pas,
    dri: r.dri,
    def: r.def,
    phy: r.phy,
    attrs: r.attrs ?? {},
  };
}

/* ---------- data ---------- */

export async function getClub(): Promise<UtClub> {
  const { data, error } = await supabase.rpc("fc_club_get" as never, {} as never);
  if (error) throw error;
  const c = data as unknown as {
    user_id: string;
    club_name: string;
    badge: string | null;
    stadium: string | null;
    coins: number;
    spin_tokens: number;
    event_tokens: number;
    xp: number;
    luck_meter: number;
    last_daily_spin_at: string | null;
  };
  return {
    userId: c.user_id,
    clubName: c.club_name,
    badge: c.badge,
    stadium: c.stadium,
    coins: c.coins,
    spinTokens: c.spin_tokens,
    eventTokens: c.event_tokens,
    xp: c.xp,
    luckMeter: c.luck_meter,
    lastDailySpinAt: c.last_daily_spin_at,
  };
}

export async function renameClub(name: string): Promise<void> {
  const { error } = await supabase.rpc("fc_club_rename" as never, { _name: name } as never);
  if (error) throw error;
}

export async function fetchSpinTypes(): Promise<UtSpinType[]> {
  const { data, error } = await supabase
    .from("fc_spin_types" as never)
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    key: string;
    label: string;
    cost_coins: number;
    cost_tokens: number;
    cost_event_tokens: number;
    cooldown_hours: number | null;
    pity_threshold: number;
    sort_order: number;
  }>).map((r) => ({
    key: r.key,
    label: r.label,
    costCoins: r.cost_coins,
    costTokens: r.cost_tokens,
    costEventTokens: r.cost_event_tokens,
    cooldownHours: r.cooldown_hours,
    pityThreshold: r.pity_threshold,
    sortOrder: r.sort_order,
  }));
}

export async function spin(spinType: string): Promise<UtSpinResult> {
  const { data, error } = await supabase.rpc("fc_spin" as never, { _spin_type: spinType } as never);
  if (error) throw error;
  const d = data as unknown as {
    card: CardRow;
    rarity: string;
    duplicate: boolean;
    pity: boolean;
    coins: number;
    spin_tokens: number;
    luck_meter: number;
    last_daily_spin_at: string | null;
  };
  return {
    card: toUtCard(d.card),
    rarity: d.rarity as Rarity,
    duplicate: d.duplicate,
    pity: d.pity,
    coins: d.coins,
    spinTokens: d.spin_tokens,
    luckMeter: d.luck_meter,
    lastDailySpinAt: d.last_daily_spin_at,
  };
}

export async function fetchCollection(userId: string): Promise<UtOwnedCard[]> {
  const { data, error } = await supabase
    .from("fc_user_cards" as never)
    .select("id,card_id,locked,favorite,source,created_at,fc_cards(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    card_id: string;
    locked: boolean;
    favorite: boolean;
    source: string | null;
    created_at: string;
    fc_cards: CardRow | null;
  }>;
  return rows
    .filter((r) => r.fc_cards)
    .map((r) => ({
      id: r.id,
      cardId: r.card_id,
      locked: r.locked,
      favorite: r.favorite,
      source: r.source,
      createdAt: r.created_at,
      card: toUtCard(r.fc_cards as CardRow),
    }));
}

export async function setCardFlags(
  userCardId: string,
  locked: boolean,
  favorite: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("fc_set_card_flags" as never, {
    _user_card_id: userCardId,
    _locked: locked,
    _favorite: favorite,
  } as never);
  if (error) throw error;
}

export async function quickSell(userCardId: string): Promise<{ coins: number; gained: number }> {
  const { data, error } = await supabase.rpc("fc_quick_sell" as never, {
    _user_card_id: userCardId,
  } as never);
  if (error) throw error;
  const d = data as unknown as { coins: number; gained: number };
  return d;
}

/* ---------- pomocné ---------- */

export function utErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.includes("cooldown_active")) return "Denní spin už byl využit — vrať se později.";
  if (raw.includes("insufficient_coins")) return "Nedostatek coinů.";
  if (raw.includes("insufficient_tokens")) return "Nedostatek spin tokenů.";
  if (raw.includes("insufficient_event_tokens")) return "Nedostatek event tokenů.";
  if (raw.includes("spin_unavailable")) return "Tento spin není momentálně dostupný.";
  if (raw.includes("card_locked")) return "Karta je zamčená — nejdřív ji odemkni.";
  if (raw.includes("card_in_squad")) return "Karta je v sestavě.";
  if (raw.includes("card_not_owned")) return "Tuto kartu nevlastníš.";
  if (raw.includes("no_profile")) return "Nejdřív si vytvoř profil.";
  if (raw.includes("not_authenticated")) return "Přihlas se.";
  return raw || "Něco se nepovedlo.";
}

export function dailyReadyIn(lastAt: string | null, cooldownHours: number | null): number {
  if (!cooldownHours || !lastAt) return 0;
  const ready = new Date(lastAt).getTime() + cooldownHours * 3600_000;
  return Math.max(0, ready - Date.now());
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
