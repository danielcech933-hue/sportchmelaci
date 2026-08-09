export type CardType = "gold" | "totw" | "icon" | "promo";

export interface FootballCardData {
  id: string;
  key: string;
  name: string;
  rating: number;
  position: string;
  nation: string;
  club: string;
  league: string;
  cardType: CardType;
  imageUrl: string | null;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface OwnedCard {
  id: string;
  cardId: string;
  card: FootballCardData;
}

export interface PackRow {
  id: string;
  packType: "gold" | "promo";
  source: string;
  opened: boolean;
  createdAt: string;
}

export interface ChallengeRow {
  id: string;
  hostId: string;
  opponentId: string | null;
  mode: string;
  ovrCap: number | null;
  status: "open" | "pending" | "accepted" | "declined" | "ready" | string;
  hostReady: boolean;
  opponentReady: boolean;
  createdAt: string;
}

export type Formation = "4-3-3" | "4-4-2";

export interface SquadState {
  formation: Formation;
  slots: Record<string, string>; // slotId -> owned card id
}
