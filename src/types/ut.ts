export type Rarity =
  | "COMMON"
  | "RARE"
  | "SUPER_RARE"
  | "SPECIAL"
  | "HERO"
  | "EVENT"
  | "UNIQUE"
  | "ICON"
  | "LEGENDARY";

export interface UtCard {
  id: string;
  key: string;
  name: string;
  rating: number;
  position: string;
  altPositions: string[];
  nation: string;
  club: string;
  league: string;
  rarity: Rarity;
  campaign: string | null;
  cardType: string;
  imageUrl: string | null;
  playstyles: string[];
  playstylesPlus: string[];
  roles: string[];
  quickSell: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  attrs: Record<string, number>;
}

export interface UtOwnedCard {
  id: string;
  cardId: string;
  locked: boolean;
  favorite: boolean;
  source: string | null;
  createdAt: string;
  card: UtCard;
}

export interface UtClub {
  userId: string;
  clubName: string;
  badge: string | null;
  stadium: string | null;
  coins: number;
  spinTokens: number;
  eventTokens: number;
  xp: number;
  luckMeter: number;
  lastDailySpinAt: string | null;
}

export interface UtSpinType {
  key: string;
  label: string;
  costCoins: number;
  costTokens: number;
  costEventTokens: number;
  cooldownHours: number | null;
  pityThreshold: number;
  sortOrder: number;
}

export interface UtSpinResult {
  card: UtCard;
  rarity: Rarity;
  duplicate: boolean;
  pity: boolean;
  coins: number;
  spinTokens: number;
  luckMeter: number;
  lastDailySpinAt: string | null;
}

export interface CollectionFilters {
  search: string;
  rarity: Rarity | "ALL";
  position: string;
  league: string;
  sort: "rating" | "newest" | "name";
}
