import { supabase } from "@/integrations/supabase/client";
import chibiAttacker from "@/assets/chibi-attacker.png";
import chibiMid from "@/assets/chibi-midfielder.png";
import chibiDef from "@/assets/chibi-defender.png";
import chibiGk from "@/assets/chibi-keeper.png";
import type {
  CardType,
  ChallengeRow,
  Formation,
  FootballCardData,
  OwnedCard,
  PackRow,
  SquadState,
} from "@/types/cards";

/* ---------- vizuál ---------- */

export const NATION_FLAG: Record<string, string> = {
  France: "🇫🇷",
  Norway: "🇳🇴",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Brazil: "🇧🇷",
  Netherlands: "🇳🇱",
  Morocco: "🇲🇦",
  Canada: "🇨🇦",
  Belgium: "🇧🇪",
  Italy: "🇮🇹",
  Sweden: "🇸🇪",
  Portugal: "🇵🇹",
  Argentina: "🇦🇷",
  Germany: "🇩🇪",
};

export const CARD_TYPE_META: Record<
  CardType,
  { label: string; frame: string; glow: string; text: string; accent: string }
> = {
  gold: {
    label: "Gold",
    frame: "border-amber-300/70 bg-gradient-to-b from-amber-200/25 via-amber-500/10 to-amber-900/30",
    glow: "shadow-[0_0_28px_-6px_rgba(251,191,36,0.6)]",
    text: "text-amber-100",
    accent: "text-amber-300",
  },
  totw: {
    label: "TOTW",
    frame: "border-slate-200/60 bg-gradient-to-b from-slate-800/70 via-slate-900/80 to-black",
    glow: "shadow-[0_0_30px_-4px_rgba(226,232,240,0.55)]",
    text: "text-slate-100",
    accent: "text-slate-200",
  },
  icon: {
    label: "Icon",
    frame: "border-zinc-100/70 bg-gradient-to-b from-zinc-200/30 via-zinc-400/15 to-zinc-900/50",
    glow: "shadow-[0_0_34px_-4px_rgba(244,244,245,0.7)]",
    text: "text-zinc-50",
    accent: "text-zinc-100",
  },
  promo: {
    label: "Special",
    frame: "border-fuchsia-300/70 bg-gradient-to-b from-fuchsia-400/25 via-purple-700/25 to-indigo-950/60",
    glow: "shadow-[0_0_34px_-4px_rgba(232,121,249,0.7)]",
    text: "text-fuchsia-50",
    accent: "text-fuchsia-200",
  },
};

const ATT = ["ST", "CF", "LW", "RW"];
const MID = ["CAM", "CM", "CDM", "LM", "RM"];

export function chibiFor(card: FootballCardData): string {
  if (card.imageUrl) return card.imageUrl;
  if (card.position === "GK") return chibiGk;
  if (ATT.includes(card.position)) return chibiAttacker;
  if (MID.includes(card.position)) return chibiMid;
  return chibiDef;
}

/* ---------- formace ---------- */

export interface SlotDef {
  id: string;
  pos: string;
  x: number; // %
  y: number; // %
}

export const FORMATIONS: Record<Formation, SlotDef[]> = {
  "4-3-3": [
    { id: "gk", pos: "GK", x: 50, y: 92 },
    { id: "lb", pos: "LB", x: 14, y: 74 },
    { id: "cb1", pos: "CB", x: 37, y: 78 },
    { id: "cb2", pos: "CB", x: 63, y: 78 },
    { id: "rb", pos: "RB", x: 86, y: 74 },
    { id: "cm1", pos: "CM", x: 26, y: 52 },
    { id: "cm2", pos: "CAM", x: 50, y: 46 },
    { id: "cm3", pos: "CM", x: 74, y: 52 },
    { id: "lw", pos: "LW", x: 20, y: 20 },
    { id: "st", pos: "ST", x: 50, y: 14 },
    { id: "rw", pos: "RW", x: 80, y: 20 },
  ],
  "4-4-2": [
    { id: "gk", pos: "GK", x: 50, y: 92 },
    { id: "lb", pos: "LB", x: 14, y: 74 },
    { id: "cb1", pos: "CB", x: 37, y: 78 },
    { id: "cb2", pos: "CB", x: 63, y: 78 },
    { id: "rb", pos: "RB", x: 86, y: 74 },
    { id: "lm", pos: "LM", x: 14, y: 48 },
    { id: "cm1", pos: "CM", x: 38, y: 50 },
    { id: "cm2", pos: "CM", x: 62, y: 50 },
    { id: "rm", pos: "RM", x: 86, y: 48 },
    { id: "st1", pos: "ST", x: 38, y: 16 },
    { id: "st2", pos: "ST", x: 62, y: 16 },
  ],
};

/* ---------- výpočty ---------- */

export function teamOvr(cards: FootballCardData[]): number {
  if (!cards.length) return 0;
  return Math.round(cards.reduce((a, c) => a + c.rating, 0) / cards.length);
}

/** Chemie 0–100: shodná národnost / klub / liga v sestavě. */
export function teamChemistry(cards: FootballCardData[]): number {
  if (cards.length < 2) return 0;
  let total = 0;
  for (const c of cards) {
    const nation = cards.filter((o) => o !== c && o.nation === c.nation).length;
    const club = cards.filter((o) => o !== c && o.club === c.club).length;
    const league = cards.filter((o) => o !== c && o.league === c.league).length;
    total += Math.min(10, nation * 3 + club * 4 + league * 2);
  }
  return Math.min(100, Math.round((total / (cards.length * 10)) * 100));
}

export const MATCH_MODES = [
  { key: "gold", label: "Zlatá liga", cap: 82 },
  { key: "silver", label: "Stříbrný pohár", cap: 79 },
  { key: "open", label: "Bez omezení", cap: null as number | null },
];

/* ---------- data ---------- */

type CardRow = {
  id: string;
  key: string;
  name: string;
  rating: number;
  position: string;
  nation: string;
  club: string;
  league: string;
  card_type: string;
  image_url: string | null;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
};

export function toCard(r: CardRow): FootballCardData {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    rating: r.rating,
    position: r.position,
    nation: r.nation,
    club: r.club,
    league: r.league,
    cardType: (r.card_type as CardType) ?? "gold",
    imageUrl: r.image_url,
    pac: r.pac,
    sho: r.sho,
    pas: r.pas,
    dri: r.dri,
    def: r.def,
    phy: r.phy,
  };
}

export async function fetchCatalog(): Promise<FootballCardData[]> {
  const { data, error } = await supabase.from("fc_cards" as never).select("*").order("rating", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CardRow[]).map(toCard);
}

export async function fetchMyCards(userId: string): Promise<OwnedCard[]> {
  const { data, error } = await supabase
    .from("fc_user_cards" as never)
    .select("id,card_id,fc_cards(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{ id: string; card_id: string; fc_cards: CardRow | null }>;
  return rows.filter((r) => r.fc_cards).map((r) => ({ id: r.id, cardId: r.card_id, card: toCard(r.fc_cards as CardRow) }));
}

export async function fetchMyPacks(userId: string): Promise<PackRow[]> {
  const { data, error } = await supabase
    .from("fc_packs" as never)
    .select("*")
    .eq("user_id", userId)
    .eq("opened", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    pack_type: string;
    source: string;
    opened: boolean;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    packType: (r.pack_type as "gold" | "promo") ?? "gold",
    source: r.source,
    opened: r.opened,
    createdAt: r.created_at,
  }));
}

export async function grantPack(packType: "gold" | "promo", source = "reward"): Promise<string> {
  const { data, error } = await supabase.rpc("fc_grant_pack" as never, {
    _pack_type: packType,
    _source: source,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function openPack(packId: string): Promise<FootballCardData[]> {
  const { data, error } = await supabase.rpc("fc_open_pack" as never, { _pack_id: packId } as never);
  if (error) throw error;
  return ((data ?? []) as unknown as CardRow[]).map(toCard);
}

export async function fetchSquad(userId: string): Promise<(SquadState & { teamOvr: number; chemistry: number }) | null> {
  const { data, error } = await supabase
    .from("fc_squads" as never)
    .select("formation,slots,team_ovr,chemistry")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const r = data as unknown as
    | { formation: string; slots: Record<string, string>; team_ovr: number; chemistry: number }
    | null;
  if (!r) return null;
  return {
    formation: (r.formation as Formation) ?? "4-3-3",
    slots: r.slots ?? {},
    teamOvr: r.team_ovr,
    chemistry: r.chemistry,
  };
}

export async function saveSquad(
  formation: Formation,
  slots: Record<string, string>,
  ovr: number,
  chem: number,
): Promise<void> {
  const { error } = await supabase.rpc("fc_save_squad" as never, {
    _formation: formation,
    _slots: slots,
    _team_ovr: ovr,
    _chemistry: chem,
  } as never);
  if (error) throw error;
}

export async function fetchChallenges(): Promise<ChallengeRow[]> {
  const { data, error } = await supabase
    .from("fc_challenges" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    host_id: string;
    opponent_id: string | null;
    mode: string;
    ovr_cap: number | null;
    status: string;
    host_ready: boolean;
    opponent_ready: boolean;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    hostId: r.host_id,
    opponentId: r.opponent_id,
    mode: r.mode,
    ovrCap: r.ovr_cap,
    status: r.status,
    hostReady: r.host_ready,
    opponentReady: r.opponent_ready,
    createdAt: r.created_at,
  }));
}

export async function createChallenge(opponentId: string | null, mode: string, ovrCap: number | null): Promise<string> {
  const { data, error } = await supabase.rpc("fc_create_challenge" as never, {
    _opponent: opponentId,
    _mode: mode,
    _ovr_cap: ovrCap,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function respondChallenge(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("fc_respond_challenge" as never, {
    _challenge_id: id,
    _accept: accept,
  } as never);
  if (error) throw error;
}

export async function setReady(id: string, ready: boolean): Promise<void> {
  const { error } = await supabase.rpc("fc_set_ready" as never, { _challenge_id: id, _ready: ready } as never);
  if (error) throw error;
}

export function cardsErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.includes("pack_limit_reached")) return "Denní limit balíčků vyčerpán.";
  if (raw.includes("pack_not_found")) return "Balíček už není dostupný.";
  if (raw.includes("ovr_cap_exceeded")) return "Sestava přesahuje limit ratingu výzvy.";
  if (raw.includes("no_squad")) return "Nejdřív si ulož sestavu.";
  if (raw.includes("self_challenge")) return "Nemůžeš vyzvat sám sebe.";
  if (raw.includes("not_participant")) return "Nejsi účastník výzvy.";
  if (raw.includes("not_authenticated")) return "Přihlas se.";
  return raw || "Něco se nepovedlo.";
}
