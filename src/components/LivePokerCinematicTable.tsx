import { AnimatePresence, motion } from "framer-motion";
import { Coins, Crown, Gem, Radio, Sparkles, Trophy, UserRound, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PokerTableFX, PokerChipFlight } from "@/components/PokerTableFX";

type Card = { r: number; s: "s" | "h" | "d" | "c" };
type Player = { userId: string; nickname: string; chips: number; bet: number; folded: boolean; allIn: boolean; acted: boolean; holeCards?: Card[] };
type Hand = { id: string; players: Player[]; communityCards?: Card[]; pot: number; stage: "preflop" | "flop" | "turn" | "river" | "done"; toAct: number; currentBet: number; deadline: number; winners: { userId: string; nickname: string; amount: number; label: string }[] | null; log: string[] };
type Tournament = { id: string; name: string; max_players: number; status: string; hand: Hand | null };
type Seat = { id: string; tournament_id: string; user_id: string; nickname: string; seat_no: number; chips: number };

type Phase = "waiting" | "deal" | "bet" | "flop" | "turn" | "river" | "showdown" | "win";

const TURN_SECONDS = 25;
const TONE = [
  "from-amber-300/25 via-amber-500/10 to-black border-amber-300/35",
  "from-cyan-300/20 via-cyan-500/8 to-black border-cyan-300/30",
  "from-emerald-300/20 via-emerald-500/8 to-black border-emerald-300/30",
  "from-fuchsia-300/20 via-purple-500/8 to-black border-purple-300/30",
  "from-yellow-300/22 via-amber-500/8 to-black border-yellow-300/30",
  "from-sky-300/20 via-blue-500/8 to-black border-sky-300/30",
];

const suitLabel: Record<Card["s"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const rankLabel = (r: number) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[r] ?? String(r);
const cardLabel = (c: Card) => `${rankLabel(c.r)}${suitLabel[c.s]}`;
const redCard = (c: Card) => c.s === "h" || c.s === "d";

function phaseFromHand(hand: Hand | null, previous: Hand | null): Phase {
  if (!hand) return "waiting";
  if (hand.stage === "done") return hand.winners?.length ? "win" : "showdown";
  const current = hand.communityCards?.length ?? 0;
  const before = previous?.id === hand.id ? previous.communityCards?.length ?? 0 : 0;
  if (current === 0 && previous?.id !== hand.id) return "deal";
  if (current === 3 && before < 3) return "flop";
  if (current === 4 && before < 4) return "turn";
  if (current === 5 && before < 5) return "river";
  const last = hand.log?.[hand.log.length - 1]?.toLowerCase() ?? "";
  if (last.includes("raise") || last.includes("navýšil")) return "bet";
  return "bet";
}

function CardView({ card, hidden, delay = 0, reveal = false }: { card?: Card; hidden?: boolean; delay?: number; reveal?: boolean }) {
  const isHidden = hidden && !reveal;
  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotateY: 180, scale: .75 }}
      animate={{ opacity: 1, y: 0, rotateY: isHidden ? 180 : 0, scale: 1 }}
      transition={{ duration: .58, delay, ease: [0.22, 1, .36, 1] }}
      className="[transform-style:preserve-3d]"
    >
      <div className={cn("relative h-16 w-11 overflow-hidden rounded-[10px] border shadow-[0_12px_24px_-12px_rgba(0,0,0,.9)] sm:h-20 sm:w-14", isHidden || !card ? "border-amber-300/25 bg-gradient-to-br from-[#0b1019] to-[#111b2d]" : "border-white/30 bg-gradient-to-b from-white to-zinc-200") }>
        {isHidden || !card ? <div className="absolute inset-1.5 rounded-md border border-amber-300/20"><div className="absolute inset-2 rounded border border-amber-200/10" /></div> : <div className={cn("flex h-full flex-col items-center justify-center font-display font-black", redCard(card) ? "text-rose-600" : "text-zinc-950")}><span className="text-lg leading-none">{rankLabel(card.r)}</span><span className="text-sm leading-none">{suitLabel[card.s]}</span></div>}
      </div>
    </motion.div>
  );
}

function Chips({ amount, active }: { amount: number; active: boolean }) {
  const count = Math.min(5, Math.max(3, Math.ceil(Math.max(amount, 1) / 700)));
  return <div className="flex items-end gap-[3px]">{Array.from({ length: count }).map((_, i) => <PokerChipFlight key={i} delay={i * .04}><motion.span animate={active ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: .8, repeat: active ? Infinity : 0 }} className="block h-2.5 w-7 rounded-full border border-amber-200/55 bg-gradient-to-b from-white/15 to-black shadow-[0_4px_8px_rgba(0,0,0,.75)]" /></PokerChipFlight>)}</div>;
}

export function LivePokerCinematicTable() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const previousHand = useRef<Hand | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [eventKey, setEventKey] = useState("initial");

  const load = async () => {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.rpc("poker_list_tournaments" as any),
      supabase.from("poker_seats").select("*").order("seat_no"),
    ]);
    setTournaments((t ?? []) as Tournament[]);
    setSeats((s ?? []) as Seat[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("poker-cinematic-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load())
      .subscribe();
    const timer = window.setInterval(() => { setTick((value) => value + 1); void load(); }, 2000);
    return () => { supabase.removeChannel(channel); window.clearInterval(timer); };
  }, []);

  const live = useMemo(() => {
    const seatedIds = new Set(seats.filter((seat) => seat.user_id === user?.id).map((seat) => seat.tournament_id));
    return tournaments.find((t) => seatedIds.has(t.id) && t.hand) ?? tournaments.find((t) => t.hand) ?? null;
  }, [tournaments, seats, user?.id]);
  const hand = live?.hand ?? null;
  const liveSeats = useMemo(() => seats.filter((s) => s.tournament_id === live?.id).sort((a, b) => a.seat_no - b.seat_no), [seats, live?.id]);

  useEffect(() => {
    const nextPhase = phaseFromHand(hand, previousHand.current);
    const previous = previousHand.current;
    const changed = hand?.id !== previous?.id || JSON.stringify(hand?.communityCards ?? []) !== JSON.stringify(previous?.communityCards ?? []) || hand?.pot !== previous?.pot || hand?.stage !== previous?.stage || hand?.toAct !== previous?.toAct || JSON.stringify(hand?.winners ?? []) !== JSON.stringify(previous?.winners ?? []);
    if (changed) {
      setPhase(nextPhase);
      setEventKey(`${hand?.id ?? "none"}:${hand?.stage ?? "waiting"}:${hand?.communityCards?.length ?? 0}:${hand?.pot ?? 0}:${hand?.toAct ?? -1}:${hand?.winners?.map((w) => `${w.userId}:${w.amount}`).join(",") ?? ""}`);
    }
    previousHand.current = hand;
  }, [hand?.id, hand?.stage, hand?.pot, hand?.toAct, hand?.communityCards, hand?.winners]);

  const activeIndex = hand?.toAct ?? -1;
  const timer = hand ? Math.max(0, Math.ceil((hand.deadline - Date.now()) / 1000)) : 0;
  const action = !hand ? "WAITING FOR LIVE HAND" : phase === "win" ? "WIN" : phase === "showdown" ? "SHOWDOWN" : phase === "flop" ? "FLOP" : phase === "turn" ? "TURN" : phase === "river" ? "RIVER" : hand.log?.[hand.log.length - 1] ?? "ACTION";
  const community = hand?.communityCards ?? [];

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#03060a] p-3 shadow-[0_35px_120px_-55px_rgba(255,204,68,.65)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,202,80,.13),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(24,177,117,.12),transparent_45%)]" />
      <PokerTableFX phase={phase === "waiting" || phase === "flop" || phase === "turn" || phase === "river" ? "deal" : phase === "bet" ? "bet" : phase === "showdown" ? "showdown" : "win"} pot={hand?.pot ?? 0} timer={timer} action={action} />

      <div className="relative mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-black/45 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300"><Radio className="h-3 w-3" /> LIVE HAND</span><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">{live?.name ?? "NO ACTIVE TABLE"}</span></div><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-300">{action} · {timer.toString().padStart(2, "0")}s</span>
      </div>

      <div className="relative mx-auto mt-3 aspect-[1.65] max-w-6xl [perspective:1800px] sm:aspect-[1.8]">
        <motion.div animate={{ rotateX: 56 }} className="absolute left-1/2 top-[54%] h-[66%] w-[90%] -translate-x-1/2 -translate-y-1/2] rounded-[50%] border-[5px] border-amber-200/20 bg-[radial-gradient(ellipse_at_center,rgba(16,90,55,.96),rgba(4,19,17,.99)_55%,#020507_75%)] shadow-[0_50px_120px_-35px_rgba(0,0,0,.95),inset_0_0_60px_rgba(0,0,0,.95)] [transform-style:preserve-3d]>
          <div className="absolute inset-[6%] rounded-[50%] border border-amber-100/10" /><div className="absolute inset-[11%] rounded-[50%] border border-white/5" />
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[24px] border border-white/8 bg-black/30 px-4 py-3 backdrop-blur"><Coins className="h-4 w-4 text-amber-300" /><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">POT</span><motion.span key={hand?.pot ?? 0} initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-xl text-amber-200">{(hand?.pot ?? 0).toLocaleString("cs-CZ")}</motion.span></div>
        </motion.div>

        <AnimatePresence mode="wait"><motion.div key={`${eventKey}:${community.length}`} className="absolute left-1/2 top-[48%] z-20 flex -translate-x-1/2 -translate-y-1/2 gap-1.5 sm:gap-2"><AnimatePresence>{Array.from({ length: 5 }).map((_, i) => <div key={i}>{community[i] ? <CardView card={community[i]} delay={i * .12} /> : <div className="h-16 w-11 rounded-[10px] border border-amber-200/10 bg-black/25 sm:h-20 sm:w-14" />}</div>)}</AnimatePresence></motion.div></AnimatePresence>

        {liveSeats.slice(0, 9).map((seat, i) => {
          const player = hand?.players.find((p) => p.userId === seat.user_id);
          const playerIndex = hand?.players.findIndex((p) => p.userId === seat.user_id) ?? -1;
          const active = playerIndex === activeIndex && hand?.stage !== "done";
          const mine = seat.user_id === user?.id;
          const reveal = hand?.stage === "done";
          const cards = player?.holeCards ?? [];
          return <motion.div key={seat.id} animate={active ? { scale: [1, 1.045, 1] } : { scale: 1 }} transition={{ duration: 1.35, repeat: active ? Infinity : 0 }} className="absolute z-30 w-[118px] -translate-x-1/2 -translate-y-1/2 sm:w-[160px]" style={{ top: `${[7,25,50,89,89,50,11,11,25][i] ?? 50}%`, left: `${[50,89,89,50,11,11,25,72,72][i] ?? 50}%` }}>
            <div className={cn("rounded-2xl border bg-gradient-to-br p-2.5 shadow-[0_24px_45px_-25px_rgba(0,0,0,.95)] backdrop-blur-xl", TONE[i % TONE.length], active && "ring-2 ring-amber-300/55 shadow-[0_0_35px_rgba(255,204,68,.25)]", player?.folded && "opacity-40 grayscale")}>
              <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30"><UserRound className="h-3.5 w-3.5 text-white/70" /></div><div className="min-w-0"><div className="truncate font-display text-[10px] text-white">{seat.nickname}</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{active ? "ACTION" : mine ? "YOU" : player?.folded ? "FOLDED" : "SEATED"}</div></div>{i === 0 && <Crown className="ml-auto h-3.5 w-3.5 text-amber-300" />}</div>
              <div className="mt-2 flex items-center justify-between gap-2"><Chips amount={player?.chips ?? seat.chips} active={active} /><span className="font-mono text-[8px] font-black text-amber-200">{player?.chips ?? seat.chips}</span></div>
              <div className="mt-2 flex gap-1.5"><CardView card={cards[0]} hidden={!mine} reveal={reveal} /><CardView card={cards[1]} hidden={!mine} reveal={reveal} delay={.05} /></div>
            </div>
            {active && <motion.div className="mx-auto mt-1 h-1 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(255,204,68,.9)]" animate={{ width: ["30%", "90%", "30%"] }} transition={{ duration: 1.4, repeat: Infinity }} />}
          </motion.div>;
        })}

        <AnimatePresence>{phase === "showdown" && <motion.div key="showdown" initial={{ opacity: 0, y: 8, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[69%] z-50 -translate-x-1/2 rounded-2xl border border-amber-300/55 bg-black/85 px-5 py-3 text-center shadow-[0_0_70px_rgba(255,204,68,.3)] backdrop-blur-xl"><div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-amber-300">SHOWDOWN</div><div className="mt-1 flex items-center gap-2 font-display text-xl text-white"><Trophy className="h-4 w-4 text-amber-300" /> REVEAL</div></motion.div>}</AnimatePresence>
        <AnimatePresence>{phase === "win" && hand?.winners?.[0] && <motion.div key={`win:${eventKey}`} initial={{ opacity: 0, y: 12, scale: .88 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute left-1/2 top-[69%] z-50 -translate-x-1/2 rounded-2xl border border-amber-300/55 bg-black/85 px-5 py-3 text-center shadow-[0_0_90px_rgba(255,204,68,.35)] backdrop-blur-xl"><div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-amber-300">WINNER</div><div className="mt-1 flex items-center gap-2 font-display text-xl text-white"><Trophy className="h-4 w-4 text-amber-300" /> {hand.winners[0].nickname}</div><div className="mt-1 font-mono text-[8px] text-emerald-300">+{hand.winners[0].amount} CHIPS · {hand.winners[0].label}</div></motion.div>}</AnimatePresence>
        <motion.div className="absolute left-1/2 top-[17%] z-50 -translate-x-1/2" animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity }}><div className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 font-mono text-[7px] font-black uppercase tracking-[.18em] text-amber-200 shadow-xl backdrop-blur-xl"><Zap className="h-3.5 w-3.5" /> {hand ? `TURN ${Math.min(timer, TURN_SECONDS)}s` : "LIVE TABLE"}</div></motion.div>
      </div>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-4">{[["DEAL","Karty letí do stolu"],["BET","Chips reagují na skutečné akce"],["STREET","Flop / turn / river podle server state"],["WIN","Pot přiletí skutečnému vítězi"]].map(([title,text], i)=><motion.div key={title} animate={{ borderColor: ((phase === "deal" && i === 0) || (phase === "bet" && i === 1) || (["flop","turn","river"].includes(phase) && i === 2) || (phase === "win" && i === 3)) ? "rgba(255,204,68,.5)" : "rgba(255,255,255,.08)" }} className="rounded-xl border bg-black/30 p-3"><div className="flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-amber-300"/><span className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/45">{title}</span></div><div className="mt-1 text-[9px] text-white/35">{text}</div></motion.div>)}</div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[.03] px-3 py-2 font-mono text-[8px] text-white/35"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Cinematic presentation is driven by the live server hand; polling/realtime refreshes are deduplicated by hand/street/pot/action keys.</div>
    </section>
  );
}
