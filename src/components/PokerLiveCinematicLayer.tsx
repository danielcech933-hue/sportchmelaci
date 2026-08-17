import { AnimatePresence, motion } from "framer-motion";
import { CircleDollarSign, Crown, Gem, Radio, Sparkles, Trophy, UserRound, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Card = { r: number; s: "s" | "h" | "d" | "c" };
type Player = { userId: string; nickname: string; chips: number; bet: number; folded: boolean; allIn: boolean; holeCards?: Card[] };
type Hand = { id?: string; players: Player[]; communityCards?: Card[]; pot: number; stage: "preflop" | "flop" | "turn" | "river" | "done"; toAct: number; deadline: number; winners?: { userId: string; nickname: string; amount: number; label: string }[] | null; log?: string[] };
type Tournament = { id: string; name: string; status: string; hand: Hand | null };
type Seat = { tournament_id: string; user_id: string; nickname: string; seat_no: number; chips: number };
type Phase = "waiting" | "deal" | "bet" | "flop" | "turn" | "river" | "showdown" | "win";

const POSITIONS = [["8%", "50%"], ["24%", "88%"], ["72%", "88%"], ["90%", "50%"], ["72%", "12%"], ["24%", "12%"]] as const;
const SUITS: Record<Card["s"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANKS: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const cardText = (card: Card) => `${RANKS[card.r] ?? card.r}${SUITS[card.s]}`;
const isRed = (card: Card) => card.s === "h" || card.s === "d";

function phaseFromTransition(current: Hand | null, previous: Hand | null): Phase {
  if (!current) return "waiting";
  if (current.stage === "done") return previous?.stage && previous.stage !== "done" ? "showdown" : "win";
  const before = previous?.id === current.id ? previous.communityCards?.length ?? 0 : -1;
  const now = current.communityCards?.length ?? 0;
  if (previous?.id !== current.id) return "deal";
  if (now === 3 && before < 3) return "flop";
  if (now === 4 && before < 4) return "turn";
  if (now === 5 && before < 5) return "river";
  const last = current.log?.[current.log.length - 1]?.toLowerCase() ?? "";
  return last.includes("raise") || last.includes("all-in") ? "bet" : "bet";
}

function CardFace({ card, down = false, delay = 0 }: { card?: Card; down?: boolean; delay?: number }) {
  const hidden = down || !card;
  return <motion.div initial={{ opacity: 0, y: -24, rotateY: 180, scale: .78 }} animate={{ opacity: 1, y: 0, rotateY: hidden ? 180 : 0, scale: 1 }} transition={{ duration: .58, delay, ease: [0.22, 1, .36, 1] }} className="[transform-style:preserve-3d]">
    <div className={cn("relative grid h-16 w-11 place-items-center overflow-hidden rounded-[11px] border shadow-[0_15px_26px_-15px_rgba(0,0,0,.9)] sm:h-20 sm:w-14", hidden ? "border-amber-300/30 bg-gradient-to-br from-[#09101a] to-[#14243a]" : "border-white/25 bg-gradient-to-b from-white to-zinc-200")}>
      {hidden ? <div className="absolute inset-1.5 rounded-md border border-amber-200/10" /> : <div className={cn("font-display text-center font-black leading-none", isRed(card) ? "text-rose-600" : "text-zinc-950")}><span className="block text-lg">{RANKS[card.r] ?? card.r}</span><span className="text-[13px]">{SUITS[card.s]}</span></div>}
    </div>
  </motion.div>;
}

function ChipBurst({ amount }: { amount: number }) {
  return <motion.div className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2" initial={{ opacity: 0, scale: .5 }} animate={{ opacity: [0, 1, 1, 0], scale: [.5, 1.1, 1.15, 1.35] }} transition={{ duration: 1.2 }}><div className="flex items-center gap-2 rounded-2xl border border-amber-300/50 bg-black/85 px-4 py-2 shadow-[0_0_60px_rgba(255,204,68,.35)] backdrop-blur-xl"><CircleDollarSign className="h-4 w-4 text-amber-300" /><span className="font-display text-xl tracking-wider text-amber-200">+{amount.toLocaleString("cs-CZ")}</span></div></motion.div>;
}

export function PokerLiveCinematicLayer() {
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [now, setNow] = useState(Date.now());
  const previous = useRef<Hand | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [eventKey, setEventKey] = useState("initial");

  const load = useCallback(async () => {
    const [{ data: tournaments }, { data: seatRows }] = await Promise.all([
      supabase.rpc("poker_list_tournaments" as any),
      supabase.from("poker_seats").select("tournament_id,user_id,nickname,seat_no,chips").order("seat_no"),
    ]);
    const list = ((tournaments ?? []) as Tournament[]).filter((item) => item.status !== "finished");
    const seatedIds = new Set(((seatRows ?? []) as Seat[]).filter((row) => row.user_id === user?.id).map((row) => row.tournament_id));
    const live = list.find((item) => seatedIds.has(item.id) && item.hand) ?? list.find((item) => item.hand?.stage && item.hand.stage !== "done") ?? list.find((item) => item.hand) ?? list[0] ?? null;
    setTournament(live);
    setSeats(live ? ((seatRows ?? []) as Seat[]).filter((row) => row.tournament_id === live.id).sort((a, b) => a.seat_no - b.seat_no) : []);
  }, [user?.id]);

  useEffect(() => {
    void load();
    const channel = supabase.channel("poker-live-cinematic").on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load()).subscribe();
    const reload = window.setInterval(() => void load(), 1500);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => { supabase.removeChannel(channel); window.clearInterval(reload); window.clearInterval(clock); };
  }, [load]);

  const hand = tournament?.hand ?? null;
  useEffect(() => {
    const before = previous.current;
    const changed = hand?.id !== before?.id || hand?.stage !== before?.stage || hand?.pot !== before?.pot || hand?.toAct !== before?.toAct || JSON.stringify(hand?.communityCards ?? []) !== JSON.stringify(before?.communityCards ?? []) || JSON.stringify(hand?.winners ?? []) !== JSON.stringify(before?.winners ?? []);
    if (!changed) return;
    const next = phaseFromTransition(hand, before);
    setPhase(next);
    setEventKey(`${hand?.id ?? "none"}:${hand?.stage ?? "waiting"}:${hand?.communityCards?.length ?? 0}:${hand?.pot ?? 0}:${hand?.toAct ?? -1}:${hand?.winners?.map((w) => `${w.userId}:${w.amount}`).join(",") ?? ""}`);
    if (next === "showdown") {
      const timer = window.setTimeout(() => setPhase("win"), 1300);
      previous.current = hand;
      return () => window.clearTimeout(timer);
    }
    previous.current = hand;
  }, [hand]);

  const board = hand?.communityCards ?? [];
  const seconds = hand ? Math.max(0, Math.ceil((hand.deadline - now) / 1000)) : 0;
  const action = !hand ? "WAITING FOR LIVE HAND" : phase === "deal" ? "DEALING" : phase === "flop" ? "FLOP" : phase === "turn" ? "TURN" : phase === "river" ? "RIVER" : phase === "showdown" ? "SHOWDOWN" : phase === "win" ? "PAYOUT" : (hand.log?.[hand.log.length - 1] ?? "ACTION");

  return <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#03060a] p-3 shadow-[0_35px_120px_-55px_rgba(255,204,68,.65)] sm:p-5">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,204,68,.12),transparent_24%),radial-gradient(circle_at_50%_90%,rgba(20,180,120,.14),transparent_44%)]" />
    <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-black/45 px-3 py-2 backdrop-blur-xl"><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300"><Radio className="h-3 w-3" /> LIVE HAND</span><span className="truncate font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">{tournament?.name ?? "NO ACTIVE TABLE"}</span></div><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-300">{action} · {seconds.toString().padStart(2, "0")}s</span></div>

    <div className="relative mx-auto aspect-[1.65] max-w-6xl [perspective:1800px] sm:aspect-[1.8]">
      <motion.div animate={{ rotateX: 56 }} className="absolute left-1/2 top-[54%] h-[66%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[5px] border-amber-200/20 bg-[radial-gradient(ellipse_at_center,rgba(16,90,55,.96),rgba(4,19,17,.99)_55%,#020507_75%)] shadow-[0_50px_120px_-35px_rgba(0,0,0,.95),inset_0_0_60px_rgba(0,0,0,.95)] [transform-style:preserve-3d]"><div className="absolute inset-[6%] rounded-[50%] border border-amber-100/10" /><div className="absolute inset-[11%] rounded-[50%] border border-white/5" /><motion.div key={hand?.pot ?? 0} initial={{ scale: .82, opacity: .6 }} animate={{ scale: [1, 1.03, 1], opacity: [1, 1, 1] }} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[24px] border border-white/8 bg-black/30 px-4 py-3 backdrop-blur"><CircleDollarSign className="h-4 w-4 text-amber-300" /><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">POT</span><span className="font-display text-xl tracking-wider text-amber-200">{(hand?.pot ?? 0).toLocaleString("cs-CZ")}</span></motion.div></motion.div>

      <AnimatePresence mode="wait"><motion.div key={`${eventKey}:board`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-1/2 top-[48%] z-20 flex -translate-x-1/2 -translate-y-1/2 gap-1.5 sm:gap-2">{Array.from({ length: 5 }).map((_, i) => board[i] ? <CardFace key={i} card={board[i]} delay={i * .11} /> : <div key={i} className="h-16 w-11 rounded-[10px] border border-amber-200/10 bg-black/25 sm:h-20 sm:w-14" />)}</motion.div></AnimatePresence>

      {seats.slice(0, 6).map((seat, i) => {
        const player = hand?.players.find((p) => p.userId === seat.user_id);
        const playerIndex = hand?.players.findIndex((p) => p.userId === seat.user_id) ?? -1;
        const active = Boolean(hand && hand.stage !== "done" && playerIndex >= 0 && hand.toAct === playerIndex);
        const mine = seat.user_id === user?.id;
        const reveal = hand?.stage === "done";
        const position = POSITIONS[i];
        return <motion.div key={seat.user_id} animate={active ? { scale: [1, 1.045, 1] } : { scale: 1 }} transition={{ duration: 1.25, repeat: active ? Infinity : 0 }} className="absolute z-30 w-[118px] -translate-x-1/2 -translate-y-1/2 sm:w-[160px]" style={{ top: position[0], left: position[1] }}><div className={cn("rounded-2xl border bg-gradient-to-br from-white/[.05] via-black/70 to-black p-2.5 shadow-[0_24px_45px_-25px_rgba(0,0,0,.95)] backdrop-blur-xl", active ? "border-amber-300/55 ring-2 ring-amber-300/25 shadow-[0_0_35px_rgba(255,204,68,.22)]" : "border-white/10", player?.folded && "opacity-40 grayscale")}><div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30"><UserRound className="h-3.5 w-3.5 text-white/70" /></div><div className="min-w-0"><div className="truncate font-display text-[10px] text-white">{seat.nickname}</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{active ? (mine ? "YOUR TURN" : "ACTION") : mine ? "YOU" : player?.folded ? "FOLDED" : "SEATED"}</div></div>{i === 0 && <Crown className="ml-auto h-3.5 w-3.5 text-amber-300" />}</div><div className="mt-2 flex items-center justify-between rounded-lg border border-white/8 bg-black/30 px-2 py-1.5"><span className="font-mono text-[7px] font-black uppercase tracking-[.12em] text-white/35">STACK</span><span className="font-mono text-[8px] font-black text-amber-200">{player?.chips ?? seat.chips}</span></div><div className="mt-2 flex gap-1.5"><CardFace card={player?.holeCards?.[0]} down={!mine && !reveal} /><CardFace card={player?.holeCards?.[1]} down={!mine && !reveal} delay={.05} /></div>{player?.bet ? <div className="mt-1 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[7px] font-black text-amber-200">BET {player.bet}</div> : null}</div>{active && <motion.div className="mx-auto mt-1 h-1 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(255,204,68,.9)]" animate={{ width: ["30%", "90%", "30%"] }} transition={{ duration: 1.4, repeat: Infinity }} />}</motion.div>;
      })}

      <AnimatePresence>{phase === "showdown" && <motion.div initial={{ opacity: 0, scale: .8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[69%] z-50 -translate-x-1/2 rounded-2xl border border-amber-300/55 bg-black/85 px-5 py-3 text-center shadow-[0_0_70px_rgba(255,204,68,.3)] backdrop-blur-xl"><div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-amber-300">SHOWDOWN</div><div className="mt-1 flex items-center gap-2 font-display text-xl text-white"><Trophy className="h-4 w-4 text-amber-300" /> REVEAL</div></motion.div>}</AnimatePresence>
      <AnimatePresence>{phase === "win" && hand?.winners?.[0] && <motion.div initial={{ opacity: 0, y: 12, scale: .88 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute left-1/2 top-[69%] z-50 -translate-x-1/2 rounded-2xl border border-amber-300/55 bg-black/85 px-5 py-3 text-center shadow-[0_0_90px_rgba(255,204,68,.35)] backdrop-blur-xl"><div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-amber-300">WINNER</div><div className="mt-1 flex items-center gap-2 font-display text-xl text-white"><Trophy className="h-4 w-4 text-amber-300" /> {hand.winners[0].nickname}</div><div className="mt-1 font-mono text-[8px] text-emerald-300">+{hand.winners[0].amount} CHIPS · {hand.winners[0].label}</div></motion.div>}</AnimatePresence>
      <motion.div className="absolute left-1/2 top-[17%] z-50 -translate-x-1/2" animate={{ y: [0, -2, 0] }} transition={{ duration: 1.1, repeat: Infinity }}><div className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 font-mono text-[7px] font-black uppercase tracking-[.18em] text-amber-200 shadow-xl backdrop-blur-xl"><Zap className="h-3.5 w-3.5" /> {hand ? `TURN ${Math.min(seconds, 25)}s` : "LIVE TABLE"}</div></motion.div>
    </div>

    <div className="relative mt-3 grid gap-2 sm:grid-cols-4">{[["DEAL", "Skutečná handa vstoupí do animace"], ["ACTION", "Bet / call / raise reaguje na server state"], ["STREETS", "Flop / turn / river se otočí podle boardu"], ["WIN", "Showdown a pot patří skutečnému vítězi"]].map(([title, text]) => <div key={title} className="rounded-xl border border-white/8 bg-black/30 p-3"><div className="flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-amber-300" /><span className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/45">{title}</span></div><div className="mt-1 text-[9px] text-white/35">{text}</div></div>)}</div>
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[.03] px-3 py-2 font-mono text-[8px] text-white/35"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Live cinematic layer: žádný autonomní phase loop; animace se spouští pouze při změně serverové handy.</div>
  </section>;
}
