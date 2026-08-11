/** Zjednodušený Texas Hold'em engine — sdílený stav rozdané hry (jeden pot, bez side potů). */

export type Suit = "s" | "h" | "d" | "c";
export interface Card {
  r: number; // 2..14
  s: Suit;
}

export const SUIT_SYMBOL: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const RANK_LABEL: Record<number, string> = {
  11: "J", 12: "Q", 13: "K", 14: "A",
};
export function cardLabel(c: Card): string {
  return `${RANK_LABEL[c.r] ?? c.r}${SUIT_SYMBOL[c.s]}`;
}
export function isRed(c: Card): boolean {
  return c.s === "h" || c.s === "d";
}

export interface PPlayer {
  userId: string;
  nickname: string;
  chips: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
}

export type Stage = "preflop" | "flop" | "turn" | "river" | "done";

export interface HandState {
  id: string;
  deck: Card[];
  players: PPlayer[];
  community: number;
  pot: number;
  stage: Stage;
  toAct: number;
  currentBet: number;
  minRaise: number;
  dealer: number;
  deadline: number;
  blind: number;
  log: string[];
  winners: { userId: string; nickname: string; amount: number; label: string }[] | null;
}

export const TURN_SECONDS = 25;
const COMMUNITY_OFFSET = 18; // až 9 hráčů × 2 karty

function shuffled(): Card[] {
  const deck: Card[] = [];
  const suits: Suit[] = ["s", "h", "d", "c"];
  for (const s of suits) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function holeCards(h: HandState, seat: number): Card[] {
  return [h.deck[seat * 2], h.deck[seat * 2 + 1]].filter(Boolean);
}
export function communityCards(h: HandState): Card[] {
  return h.deck.slice(COMMUNITY_OFFSET, COMMUNITY_OFFSET + h.community);
}

function nextIdx(h: HandState, from: number): number {
  for (let i = 1; i <= h.players.length; i++) {
    const idx = (from + i) % h.players.length;
    const p = h.players[idx];
    if (!p.folded && !p.allIn && p.chips > 0) return idx;
  }
  return from;
}

function activePlayers(h: HandState): PPlayer[] {
  return h.players.filter((p) => !p.folded);
}

export function startHand(
  seats: { userId: string; nickname: string; chips: number }[],
  dealer: number,
  blind: number,
): HandState {
  const players: PPlayer[] = seats.map((s) => ({
    userId: s.userId,
    nickname: s.nickname,
    chips: s.chips,
    bet: 0,
    folded: s.chips <= 0,
    allIn: false,
    acted: false,
  }));

  const h: HandState = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deck: shuffled(),
    players,
    community: 0,
    pot: 0,
    stage: "preflop",
    toAct: 0,
    currentBet: 0,
    minRaise: blind * 2,
    dealer: dealer % players.length,
    deadline: Date.now() + TURN_SECONDS * 1000,
    blind,
    log: ["Nová hra — rozdáno."],
    winners: null,
  };

  const sb = nextIdx(h, h.dealer);
  const bb = nextIdx(h, sb);
  post(h, sb, blind);
  post(h, bb, blind * 2);
  h.currentBet = blind * 2;
  h.toAct = nextIdx(h, bb);
  return h;
}

function post(h: HandState, idx: number, amount: number) {
  const p = h.players[idx];
  const pay = Math.min(amount, p.chips);
  p.chips -= pay;
  p.bet += pay;
  if (p.chips === 0) p.allIn = true;
}

function clone(h: HandState): HandState {
  return JSON.parse(JSON.stringify(h)) as HandState;
}

export type PokerAction = "fold" | "check" | "call" | "raise" | "allin";

export function applyAction(prev: HandState, userId: string, action: PokerAction, amount = 0): HandState {
  const h = clone(prev);
  if (h.stage === "done") return h;
  const idx = h.players.findIndex((p) => p.userId === userId);
  if (idx < 0 || idx !== h.toAct) return h;
  const p = h.players[idx];

  if (action === "fold") {
    p.folded = true;
    p.acted = true;
    h.log.push(`${p.nickname}: fold`);
  } else if (action === "check") {
    if (p.bet < h.currentBet) return h;
    p.acted = true;
    h.log.push(`${p.nickname}: check`);
  } else if (action === "call") {
    post(h, idx, h.currentBet - p.bet);
    p.acted = true;
    h.log.push(`${p.nickname}: call ${h.currentBet}`);
  } else if (action === "raise" || action === "allin") {
    const target = action === "allin" ? p.bet + p.chips : Math.max(amount, h.currentBet + h.minRaise);
    const pay = Math.min(target - p.bet, p.chips);
    post(h, idx, pay);
    if (p.bet > h.currentBet) {
      h.minRaise = Math.max(h.minRaise, p.bet - h.currentBet);
      h.currentBet = p.bet;
      h.players.forEach((o, i) => {
        if (i !== idx && !o.folded && !o.allIn) o.acted = false;
      });
    }
    p.acted = true;
    h.log.push(`${p.nickname}: ${action === "allin" ? "ALL-IN" : "raise"} ${p.bet}`);
  }

  return advance(h);
}

function advance(h: HandState): HandState {
  const alive = activePlayers(h);
  if (alive.length <= 1) {
    collect(h);
    return finish(h, alive);
  }

  const pending = h.players.filter((p) => !p.folded && !p.allIn && (!p.acted || p.bet !== h.currentBet));
  if (pending.length > 0) {
    h.toAct = nextIdx(h, h.toAct);
    h.deadline = Date.now() + TURN_SECONDS * 1000;
    return h;
  }

  collect(h);
  h.players.forEach((p) => {
    p.acted = false;
  });
  h.currentBet = 0;
  h.minRaise = h.blind * 2;

  if (h.stage === "preflop") {
    h.stage = "flop";
    h.community = 3;
  } else if (h.stage === "flop") {
    h.stage = "turn";
    h.community = 4;
  } else if (h.stage === "turn") {
    h.stage = "river";
    h.community = 5;
  } else {
    h.community = 5;
    return finish(h, activePlayers(h));
  }
  h.log.push(`— ${h.stage.toUpperCase()} —`);

  const canAct = h.players.filter((p) => !p.folded && !p.allIn);
  if (canAct.length === 0) {
    if (h.stage !== "river") return advance(h);
    return finish(h, activePlayers(h));
  }
  h.toAct = nextIdx(h, h.dealer);
  h.deadline = Date.now() + TURN_SECONDS * 1000;
  return h;
}

function collect(h: HandState) {
  h.players.forEach((p) => {
    h.pot += p.bet;
    p.bet = 0;
  });
}

function finish(h: HandState, alive: PPlayer[]): HandState {
  h.stage = "done";
  h.community = 5;
  const board = communityCards(h);
  const scored = alive.map((p) => {
    const seat = h.players.findIndex((x) => x.userId === p.userId);
    const ev = alive.length === 1 ? { score: 0, label: "Ostatní složili" } : evaluate7([...holeCards(h, seat), ...board]);
    return { p, ...ev };
  });
  const best = Math.max(...scored.map((s) => s.score));
  const winners = scored.filter((s) => s.score === best);
  const share = Math.floor(h.pot / winners.length);
  h.winners = winners.map((w) => ({
    userId: w.p.userId,
    nickname: w.p.nickname,
    amount: share,
    label: w.label,
  }));
  winners.forEach((w) => {
    const target = h.players.find((x) => x.userId === w.p.userId);
    if (target) target.chips += share;
  });
  h.log.push(`Vítěz: ${winners.map((w) => `${w.p.nickname} (${w.label})`).join(", ")} — pot ${h.pot}`);
  h.pot = 0;
  return h;
}

/* ============ Vyhodnocení kombinací ============ */
const CATEGORY_LABEL = [
  "Vysoká karta",
  "Pár",
  "Dva páry",
  "Trojice",
  "Straight",
  "Flush",
  "Full house",
  "Čtyřice",
  "Straight flush",
];

function score5(cards: Card[]): { score: number; label: string } {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const flush = cards.every((c) => c.s === cards[0].s);

  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }

  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  let cat: number;
  if (straightHigh && flush) cat = 8;
  else if (groups[0][1] === 4) cat = 7;
  else if (groups[0][1] === 3 && groups[1]?.[1] === 2) cat = 6;
  else if (flush) cat = 5;
  else if (straightHigh) cat = 4;
  else if (groups[0][1] === 3) cat = 3;
  else if (groups[0][1] === 2 && groups[1]?.[1] === 2) cat = 2;
  else if (groups[0][1] === 2) cat = 1;
  else cat = 0;

  const kickers = cat === 4 || cat === 8 ? [straightHigh] : groups.map((g) => g[0]);
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (kickers[i] ?? 0);
  return { score, label: CATEGORY_LABEL[cat] };
}

export function evaluate7(cards: Card[]): { score: number; label: string } {
  const list = cards.filter(Boolean);
  if (list.length < 5) return { score: 0, label: "—" };
  let best = { score: -1, label: "—" };
  for (let a = 0; a < list.length - 4; a++)
    for (let b = a + 1; b < list.length - 3; b++)
      for (let c = b + 1; c < list.length - 2; c++)
        for (let d = c + 1; d < list.length - 1; d++)
          for (let e = d + 1; e < list.length; e++) {
            const r = score5([list[a], list[b], list[c], list[d], list[e]]);
            if (r.score > best.score) best = r;
          }
  return best;
}
