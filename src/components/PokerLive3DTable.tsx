import { motion, AnimatePresence } from "framer-motion";
import { Coins, Crown, Radio, Trophy, UserRound, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Card = { r: number; s: "s" | "h" | "d" | "c" };
type Player = { userId: string; nickname: string; chips: number; bet: number; folded: boolean; allIn: boolean; holeCards?: Card[] };
type Hand = { players: Player[]; communityCards?: Card[]; pot: number; stage: string; toAct: number; deadline: number; winners?: { userId: string; nickname: string; amount: number; label: string }[] | null };
type Tournament = { id: string; name: string; status: string; max_players: number; hand: Hand | null };
type Seat = { user_id: string; nickname: string; seat_no: number; chips: number };

const POS = [["8%","50%"],["22%","88%"],["72%","88%"],["90%","50%"],["72%","12%"],["22%","12%"]] as const;
const SUIT: Record<Card["s"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANK: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const label = (c: Card) => `${RANK[c.r] ?? c.r}${SUIT[c.s]}`;
const red = (c: Card) => c.s === "h" || c.s === "d";
const STAGES = ["preflop", "flop", "turn", "river"];

function Card3D({ card, hidden, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  return <motion.div initial={{ opacity: 0, y: -24, rotateY: 180, scale: .75 }} animate={{ opacity: 1, y: 0, rotateY: hidden ? 180 : 0, scale: 1 }} transition={{ duration: .52, delay }} className="[transform-style:preserve-3d]">
    <div className={cn("relative grid h-14 w-10 place-items-center overflow-hidden rounded-lg border shadow-[0_14px_26px_-16px_rgba(0,0,0,.95)] sm:h-18 sm:w-13", hidden ? "border-amber-300/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,208,75,.25),transparent_26%),linear-gradient(135deg,#101828,#05070b)]" : "border-white/40 bg-gradient-to-b from-white to-zinc-200", !hidden && red(card!) ? "text-rose-600" : "text-zinc-950")}>{hidden ? <div className="absolute inset-1.5 rounded border border-amber-200/15" /> : <span className="font-display text-base font-black leading-none">{label(card!)}</span>}</div>
  </motion.div>;
}

export function PokerLive3DTable() {
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [tick, setTick] = useState(Date.now());

  const load = useCallback(async () => {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.rpc("poker_list_tournaments" as any),
      supabase.from("poker_seats").select("tournament_id,user_id,nickname,seat_no,chips").order("seat_no"),
    ]);
    const list = ((t ?? []) as Tournament[]).filter((x) => x.status !== "finished");
    const next = list.find((x) => x.hand?.stage && x.hand.stage !== "done") ?? list[0] ?? null;
    setTournament(next);
    setSeats(next ? ((s ?? []) as Seat[]).filter((x) => x.tournament_id === next.id) : []);
  }, []);

  useEffect(() => { void load(); const c = supabase.channel("poker-3d-live").on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load()).subscribe(); const h = window.setInterval(() => void load(), 2500); const t = window.setInterval(() => setTick(Date.now()), 250); return () => { supabase.removeChannel(c); window.clearInterval(h); window.clearInterval(t); }; }, [load]);

  const hand = tournament?.hand ?? null;
  const board = hand?.communityCards ?? [];
  const seconds = hand ? Math.max(0, Math.ceil((hand.deadline - tick) / 1000)) : 0;
  const players = hand?.players ?? [];
  const stageIndex = Math.max(0, STAGES.indexOf(hand?.stage ?? "preflop"));

  return <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#03060a] p-3 shadow-[0_35px_120px_-55px_rgba(255,204,68,.58)] sm:p-5">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,204,68,.12),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(0,211,158,.1),transparent_45%)]" />
    <div className="relative z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-black/55 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300"><Radio className="h-3 w-3"/>LIVE MULTIPLAYER</span><span className="truncate font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/38">{tournament?.name ?? "ČEKÁM NA STŮL"}</span></div>
      <span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-300">{hand ? `${hand.stage.toUpperCase()} · ${seconds}s` : "LOBBY"}</span>
    </div>

    <div className="relative z-20 mb-2 grid grid-cols-4 gap-1 rounded-xl border border-white/8 bg-black/45 p-1 backdrop-blur-xl">
      {STAGES.map((stage, i) => <div key={stage} className={cn("rounded-lg px-2 py-1.5 text-center font-mono text-[7px] font-black uppercase tracking-[.16em] transition", i === stageIndex && hand?.stage !== "done" ? "bg-amber-300 text-black shadow-[0_0_18px_rgba(255,204,68,.28)]" : i < stageIndex ? "bg-emerald-300/10 text-emerald-300" : "text-white/25")}>{stage}</div>)}
    </div>

    <div className="relative mx-auto aspect-[1.65] max-w-6xl [perspective:1800px]">
      <motion.div animate={{ rotateX: 56 }} className="absolute left-1/2 top-[55%] h-[66%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[5px] border-amber-200/20 bg-[radial-gradient(ellipse_at_center,rgba(15,91,54,.97),rgba(2,14,12,.99)_58%,#010204_78%)] shadow-[0_50px_120px_-35px_rgba(0,0,0,.96),inset_0_0_70px_rgba(0,0,0,.94)] [transform-style:preserve-3d]>
        <div className="absolute inset-[6%] rounded-[50%] border border-amber-100/10"/><div className="absolute inset-[11%] rounded-[50%] border border-white/5"/>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><div className="flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-black/35 px-4 py-2.5 backdrop-blur"><Coins className="h-4 w-4 text-amber-300"/><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">POT</span><span className="font-display text-2xl text-amber-200">{hand?.pot ?? 0}</span></div></div>
        <div className="absolute left-1/2 top-[72%] -translate-x-1/2 font-mono text-[7px] font-black uppercase tracking-[.4em] text-white/15">SPORTCHMELÁCI CARD ROOM</div>
      </motion.div>

      <AnimatePresence mode="wait"><motion.div key={board.map(label).join("-")} initial={{ opacity: 0, scale: .82, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute left-1/2 top-[48%] z-30 flex -translate-x-1/2 -translate-y-1/2 gap-1.5 sm:gap-2">{Array.from({ length: 5 }).map((_, i) => board[i] ? <Card3D key={i} card={board[i]} delay={i*.1}/> : <div key={i} className="h-14 w-10 rounded-lg border border-amber-200/10 bg-black/20 sm:h-18 sm:w-13"/>)}</motion.div></AnimatePresence>

      {seats.slice(0,6).map((seat, i) => { const p = players.find((x) => x.userId === seat.user_id); const active = !!hand && hand.toAct === players.findIndex((x) => x.userId === seat.user_id); const mine = seat.user_id === user?.id; const winner = !!hand?.winners?.some((w) => w.userId === seat.user_id); const pos = POS[i]; return <motion.div key={seat.user_id} animate={active ? { scale: [1,1.05,1] } : { scale: 1 }} transition={{ duration: 1.3, repeat: active ? Infinity : 0 }} className="absolute z-40 w-[112px] -translate-x-1/2 -translate-y-1/2 sm:w-[150px]" style={{ top: pos[0], left: pos[1] }}>
        <div className={cn("rounded-2xl border bg-gradient-to-br from-white/[.08] via-black/80 to-black/95 p-2.5 backdrop-blur-xl shadow-[0_24px_45px_-25px_rgba(0,0,0,.95)]", active ? "border-amber-300/60 ring-2 ring-amber-300/25 shadow-[0_0_35px_rgba(255,204,68,.22)]" : winner ? "border-emerald-300/55 ring-2 ring-emerald-300/20" : "border-white/10", p?.folded && "opacity-35 grayscale") }>
          <div className="flex items-center gap-1.5"><div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30"><UserRound className="h-3.5 w-3.5 text-white/70"/></div><div className="min-w-0 flex-1"><div className="truncate font-display text-[10px] text-white">{seat.nickname}</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{active ? (mine ? "YOUR TURN" : "ACTION") : p?.allIn ? "ALL-IN" : p?.folded ? "FOLDED" : "READY"}</div></div>{winner ? <Trophy className="h-3.5 w-3.5 text-emerald-300"/> : i===0 ? <Crown className="h-3.5 w-3.5 text-amber-300"/> : null}</div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[8px]"><span className="text-white/30">STACK</span><span className="font-black text-amber-200">{p?.chips ?? seat.chips}</span></div>
          {p?.holeCards && <div className="mt-2 flex gap-1">{p.holeCards.slice(0,2).map((c,j)=><Card3D key={j} card={c} hidden={false} delay={j*.06}/>)}</div>}
          {active && <motion.div className="mt-1 h-1 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(255,204,68,.9)]" animate={{ opacity:[.25,1,.25] }} transition={{ duration:1, repeat:Infinity }}/>} 
          {p?.bet ? <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[7px] font-black text-amber-200">BET {p.bet}</div> : null}
        </div>
      </motion.div> })}

      {!tournament && <div className="absolute inset-0 z-50 grid place-items-center"><div className="rounded-2xl border border-white/10 bg-black/75 px-5 py-4 text-center backdrop-blur-xl"><Zap className="mx-auto h-5 w-5 text-amber-300"/><div className="mt-2 font-display text-xl text-white">ČEKÁNÍ NA MULTIPLAYER STŮL</div><div className="mt-1 font-mono text-[8px] uppercase tracking-[.2em] text-white/35">Vytvoř nebo se připoj k pokerovému stolu níže</div></div></div>}
    </div>
  </section>;
}
