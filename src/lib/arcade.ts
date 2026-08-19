import { supabase } from "@/integrations/supabase/client";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface ArcadeItem {
  id: string;
  key: string;
  name: string;
  slot: string;
  rarity: Rarity;
  icon: string;
  valuePoints: number;
}

export interface InventoryEntry {
  id: string;
  userId: string;
  itemId: string;
  equipped: boolean;
  item: ArcadeItem;
}

export interface Listing {
  id: string;
  sellerId: string;
  inventoryId: string;
  itemId: string;
  price: number;
  status: string;
  createdAt: string;
  item: ArcadeItem | null;
}

export interface ArcadeMatchRow {
  id: string;
  playerA: string;
  playerB: string | null;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  crateOpened: boolean;
  createdAt: string;
}

export const RARITY_META: Record<Rarity, { label: string; chance: string; ring: string; text: string }> = {
  common: { label: "Common", chance: "60 %", ring: "border-border/70 bg-surface/60", text: "text-muted-foreground" },
  rare: { label: "Rare", chance: "25 %", ring: "border-sky-400/50 bg-sky-400/10", text: "text-sky-300" },
  epic: { label: "Epic", chance: "12 %", ring: "border-fuchsia-400/50 bg-fuchsia-400/10", text: "text-fuchsia-300" },
  legendary: { label: "Legendary", chance: "3 %", ring: "border-primary/60 bg-primary/10", text: "text-primary" },
};

export const ARCADE_RANKS = [
  { min: 0, label: "Rookie", icon: "🕹️" },
  { min: 300, label: "Bronze Bot", icon: "🥉" },
  { min: 700, label: "Silver Sprinter", icon: "🥈" },
  { min: 1200, label: "Gold Glitch", icon: "🥇" },
  { min: 2000, label: "Neon Legend", icon: "🌟" },
];

export function arcadeRank(points: number) {
  let out = ARCADE_RANKS[0];
  for (const r of ARCADE_RANKS) if (points >= r.min) out = r;
  return out;
}

type ItemRow = {
  id: string;
  key: string;
  name: string;
  slot: string;
  rarity: string;
  icon: string;
  value_points: number;
};

function toItem(r: ItemRow): ArcadeItem {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    slot: r.slot,
    rarity: (r.rarity as Rarity) ?? "common",
    icon: r.icon,
    valuePoints: r.value_points,
  };
}

export async function fetchArcadeItems(): Promise<ArcadeItem[]> {
  const { data, error } = await supabase.from("arcade_items").select("*").order("value_points");
  if (error) throw error;
  return ((data ?? []) as ItemRow[]).map(toItem);
}

export async function fetchInventory(userId: string): Promise<InventoryEntry[]> {
  const { data, error } = await supabase
    .from("arcade_inventory")
    .select("id,user_id,item_id,equipped,created_at,arcade_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    item_id: string;
    equipped: boolean;
    arcade_items: ItemRow | null;
  }>;
  return rows
    .filter((r) => r.arcade_items)
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      itemId: r.item_id,
      equipped: r.equipped,
      item: toItem(r.arcade_items as ItemRow),
    }));
}

export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("arcade_listings")
    .select("id,seller_id,inventory_id,item_id,price,status,created_at,arcade_items(*)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    seller_id: string;
    inventory_id: string;
    item_id: string;
    price: number;
    status: string;
    created_at: string;
    arcade_items: ItemRow | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    sellerId: r.seller_id,
    inventoryId: r.inventory_id,
    itemId: r.item_id,
    price: r.price,
    status: r.status,
    createdAt: r.created_at,
    item: r.arcade_items ? toItem(r.arcade_items) : null,
  }));
}

export async function fetchArcadeMatches(userId: string): Promise<ArcadeMatchRow[]> {
  const { data, error } = await supabase
    .from("arcade_matches")
    .select("*")
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    player_a: string;
    player_b: string | null;
    score_a: number;
    score_b: number;
    winner_id: string | null;
    crate_opened: boolean;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    playerA: r.player_a,
    playerB: r.player_b,
    scoreA: r.score_a,
    scoreB: r.score_b,
    winnerId: r.winner_id,
    crateOpened: r.crate_opened,
    createdAt: r.created_at,
  }));
}

export async function reportArcadeMatch(opponentId: string | null, scoreA: number, scoreB: number): Promise<string> {
  const { data, error } = await supabase.rpc("arcade_report_match" as never, {
    _opponent: opponentId,
    _score_a: scoreA,
    _score_b: scoreB,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function openCrate(matchId: string): Promise<ArcadeItem & { valuePoints: number }> {
  const { data, error } = await supabase.rpc("arcade_open_crate" as never, { _match_id: matchId } as never);
  if (error) throw error;
  const d = data as unknown as {
    item_id: string;
    key: string;
    name: string;
    rarity: string;
    icon: string;
    slot: string;
    value_points: number;
  };
  return {
    id: d.item_id,
    key: d.key,
    name: d.name,
    slot: d.slot,
    rarity: (d.rarity as Rarity) ?? "common",
    icon: d.icon,
    valuePoints: d.value_points,
  };
}

export async function equipItem(inventoryId: string, equip: boolean): Promise<void> {
  const { error } = await supabase.rpc("arcade_equip" as never, {
    _inventory_id: inventoryId,
    _equip: equip,
  } as never);
  if (error) throw error;
}

export async function listItem(inventoryId: string, price: number): Promise<void> {
  const { error } = await supabase.rpc("arcade_list_item" as never, {
    _inventory_id: inventoryId,
    _price: price,
  } as never);
  if (error) throw error;
}

export async function cancelListing(listingId: string): Promise<void> {
  const { error } = await supabase.rpc("arcade_cancel_listing" as never, { _listing_id: listingId } as never);
  if (error) throw error;
}

export async function buyListing(listingId: string): Promise<void> {
  const { error } = await supabase.rpc("arcade_buy_listing" as never, { _listing_id: listingId } as never);
  if (error) throw error;
}

export async function fetchArcadeProfile(userId: string): Promise<{ arcadePoints: number; elo: number }> {
  const { data, error } = await supabase
    .from("profile_public")
    .select("arcade_points,elo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const p = data as { arcade_points?: number; elo?: number } | null;
  return { arcadePoints: Number(p?.arcade_points ?? 0), elo: Number(p?.elo ?? 1000) };
}

export function arcadeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.includes("insufficient_points")) return "Nedostatek arcade bodů.";
  if (raw.includes("crate_already_opened")) return "Bedna už byla otevřena.";
  if (raw.includes("not_winner")) return "Bednu může otevřít jen vítěz.";
  if (raw.includes("own_listing")) return "Nemůžeš kupovat vlastní nabídku.";
  if (raw.includes("already_listed")) return "Předmět už je v nabídce.";
  if (raw.includes("listing_not_found")) return "Nabídka už není dostupná.";
  if (raw.includes("not_owner")) return "Tento předmět ti nepatří.";
  if (raw.includes("not_authenticated")) return "Přihlas se.";
  return raw || "Něco se nepovedlo.";
}
