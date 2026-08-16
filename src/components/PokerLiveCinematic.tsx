import { AnimatePresence, motion } from "framer-motion";
import { Coins, Crown, Radio, Trophy, UserRound, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Card = { r: number; s: "s" | "h" | "d" | "c" };
type Player = { userId: string; nickname: string; chips: number; bet: number; folded: boolean; allIn: boolean; holeCards?: Card[] };
type Hand = { id: string; players: Player[]; communityCards?: Card[]; stage: "preflop" | "flop" | "turn" | "river" | "done"; toAct: number; pot: number; currentBet: number; dealer: number; deadline: number; winners: { userId: string; nickname: string; amount: number; label: string }[] | null };
type Tournament = { id: string; name: string; max_players: number; status: string; hand: Hand | null };
type Seat = { id: string; tournament_id: string; user_id: string; nickname: string; seat_no: number; chips: number };

const SUIT: Record<Card["s"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const rank = (r: number) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[r] ?? String(r);
const red = (s: Card["s"]) => s === "h" || s === "d";

function LiveCard({ card, hidden = false, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24, rotateY: 180, scale: 0.78 }}
      animate={{ opacity: 1, y: 0, rotateY: hidden ? 180 : 0, scale: 1 }}
      transition={{ duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] }}
      className="[transform-style:preserve-3d]"
    >
      <div className={cn(
        "relative flex h-14 w-10 items-center justify-center rounded-[9px] border shadow-[0_12px_26px_-14px_rgba(0,0,0,.95)] sm:h-16 sm:w-12",
        hidden || !card ? "border-amber-300/20 bg-[linear-gradient(135deg,#0a0f18,#172238)]" : "border-white/40 bg-gradient-to-b from-white to-slate-200",
      )}>
        {hidden || !card ? <div className="absolute inset-1.5 rounded border border-amber-300/15 bg-[radial-gradient(circle_at_30%_30%,rgba(255,210,80,.24),transparent_26%)]" /> : (
          <span className={cn("flex flex-col items-center font-black leading-none", red(card.s) ? "text-rose-600" : "text-slate-950")}>
            <span className="text-sm">{rank(card.r)}</span><span className="text-[11px]">{SUIT[card.s]}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

function SeatCard({ player, active, winner, hero }: { player?: Player; active: boolean; winner: boolean; hero: boolean }) {
  const chips = player?.chips ?? 0;
  return (
    <motion.div animate={active ? { scale: [1, 1.045, 1] } : winner ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: winner ? 0.8 : 1.3, repeat: active || winner ? Infinity : 0 }} className={cn("rounded-2xl border bg-black/60 p-2.5 backdrop-blur-xl", active && "border-amber-300/55 ring-2 ring-amber-300/20", winner && "border-emerald-300/60 shadow-[0_0_40px_rgba(52,211,153,.18)]", !active && !winner && "border-white/10")}>
      <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5"><UserRound className="h-3.5 w-3.5 text-white/70" /></span><div className="min-w-0 flex-1"><div className="truncate font-display text-[10px] tracking-wide text-white">{player?.nickname ?? "EMPTY"}</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{winner ? "WINNER" : active ? "YOUR ACTION" : player?.folded ? "FOLDED" : player?.allIn ? "ALL-IN" : hero ? "YOU" : "SEATED"}</div></div>{winner && <Trophy className="h-3.5 w-3.5 text-emerald-300" />}</div>
      <div className="mt-2 flex items-center justify-between font-mono text-[8px] uppercase"><span className="text-white/30">STACK</span><span className="font-black text-amber-200">{chips.toLocaleString("cs-CZ")}</span></div>
      <div className="mt-2 flex gap-1"><LiveCard card={player?.holeCards?.[0]} hidden={!hero} /><LiveCard card={player?.holeCards?.[1]} hidden={!hero} delay={0.05}/>{player?.bet ? <span className="ml-auto self-center rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 font-mono text-[7px] font-black text-amber-200">BET {player.bet}</span> : null}</div>
    </motion.div>
  );
}

export function PokerLiveCinematic({ userId }: { userId?: string }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [now, setNow] = useState(Date.now());
  const [previousPot, setPreviousPot] = useState(0);
  const prevStage = useRef<string | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.rpc("poker_list_tournaments" as any),
        supabase.from("poker_seats").select("*").order("seat_no"),
      ]);
      if (cancelled) return;
      setTournaments((t ?? []) as Tournament[]);
      setSeats((s ?? []) as Seat[]);
    };
    void load();
    const timer = window.setInterval(() => void load(), 1500);
    const channel = supabase.channel("poker-cinematic-live").on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load()).subscribe();
    return () => { cancelled = true; window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, []);

  const tournament = tournaments.find(t => t.hand && t.status !== "finished") ?? tournaments.find(t => t.status !== "finished") ?? null;
  const hand = tournament?.hand ?? null;
  const tableSeats = useMemo(() => seats.filter(s => s.tournament_id === tournament?.id).sort((a,b) => a.seat_no - b.seat_no).slice(0, 6), [seats, tournament?.id]);
  const seconds = hand ? Math.max(0, Math.ceil((hand.deadline - now) / 1000)) : 0;
  const heroIndex = hand?.players.findIndex(p => p.userId === userId) ?? -1;

  useEffect(() => {
    const pot = hand?.pot ?? 0;
    if (pot !== previousPot) setPreviousPot(pot);
  }, [hand?.pot]);

  useEffect(() => {
    const stage = hand?.stage ?? null;
    if (stage && stage !== prevStage.current) prevStage.current = stage;
  }, [hand?.stage]);

  if (!tournament) return null;
  const board = hand?.communityCards ?? [];
  const winnerId = hand?.winners?.[0]?.userId;
  const actionLabel = hand?.stage === "done" ? "SHOWDOWN" : hand ? (hand.toAct >= 0 ? "ACTION" : "WAITING") : "LOBBY";

  return (
    <section className="relative mb-5 overflow-hidden rounded-[34px] border border-amber-300/20 bg-[#03060a] p-3 shadow-[0_35px_120px_-55px_rgba(255,204,68,.65)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,204,68,.12),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(25,180,120,.13),transparent_44%)]" />
      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-black/45 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300"><Radio className="h-3 w-3" /> LIVE ENGINE</span><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/35">{tournament.name} · CINEMATIC TABLE</span></div>
        <span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-300">{actionLabel} · {seconds.toString().padStart(2, "0")}s</span>
      </div>

      <div className="relative mx-auto aspect-[1.55] max-w-6xl [perspective:1800px] sm:aspect-[1.8]">
        <motion.div animate={{ rotateX: 56 }} transition={{ duration: .65 }} className="absolute left-1/2 top-[55%] h-[66%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[5px] border-amber-200/20 bg-[radial-gradient(ellipse_at_center,rgba(16,90,55,.96),rgba(4,19,17,.99)_55%,#020507_75%)] shadow-[0_50px_120px_-35px_rgba(0,0,0,.95),inset_0_0_60px_rgba(0,0,0,.95)] [transform-style:preserve-3d]">
          <div className="absolute inset-[6%] rounded-[50%] border border-emerald-200/10" /><div className="absolute inset-[11%] rounded-[50%] border border-white/5" />
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[22px] border border-white/8 bg-black/30 px-4 py-3 backdrop-blur"><Coins className="h-4 w-4 text-amber-300"/><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">POT</span><motion.span key={hand?.pot} initial={{ scale: 1.2, color: "#fff" }} animate={{ scale: 1, color: "#fde68a" }} className="font-display text-xl tracking-wider">{(hand?.pot ?? 0).toLocaleString("cs-CZ")}</motion.span></div>
        </motion.div>

        <AnimatePresence mode="popLayout"><motion.div key={board.length} className="absolute left-1/2 top-[49%] z-20 flex -translate-x-1/2 -translate-y-1/2 gap-1.5 sm:gap-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
          {Array.from({length:5},(_,i)=> board[i] ? <LiveCard key={i} card={board[i]} delay={i*.08}/> : <div key={i} className="h-14 w-10 rounded-[9px] border border-white/5 bg-black/20 sm:h-16 sm:w-12" />)}
        </motion.div></AnimatePresence>

        {tableSeats.map((seat, i) => {
          const player = hand?.players.find(p => p.userId === seat.user_id);
          const idx = hand?.players.findIndex(p => p.userId === seat.user_id) ?? -1;
          const angle = -90 + i * (360 / Math.max(6, tableSeats.length));
          const x = 50 + Math.cos(angle * Math.PI/180) * 41;
          const y = 51 + Math.sin(angle * Math.PI/180) * 30;
          return <motion.div key={seat.id} className="absolute z-30 w-[122px] -translate-x-1/2 -translate-y-1/2 sm:w-[165px]" style={{ left: `${x}%`, top: `${y}%` }} initial={{ opacity: 0, scale: .82 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i*.04 }}><SeatCard player={player} active={!!hand && idx === hand.toAct && hand.stage !== "done"} winner={winnerId === seat.user_id} hero={seat.user_id === userId}/></motion.div>;
        })}

        {hand?.stage === "done" && hand.winners?.[0] && <motion.div initial={{ opacity: 0, scale: .75 }} animate={{ opacity: 1, scale: 1 }} className="absolute left-1/2 top-[73%] z-50 -translate-x-1/2 rounded-2xl border border-emerald-300/45 bg-black/85 px-5 py-3 text-center shadow-[0_0_70px_rgba(52,211,153,.2)] backdrop-blur-xl"><div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-emerald-300">SHOWDOWN</div><div className="mt-1 flex items-center gap-2 font-display text-xl tracking-[.12em] text-white"><Trophy className="h-4 w-4 text-amber-300" /> {hand.winners[0].nickname}</div><div className="mt-1 font-mono text-[8px] text-amber-200">+{hand.winners[0].amount.toLocaleString("cs-CZ")} · {hand.winners[0].label}</div></motion.div>}
        <motion.div animate={hand?.stage === "done" ? { opacity: 1 } : { opacity: .75 }} className="absolute left-1/2 top-[16%] z-50 -translate-x-1/2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 font-mono text-[7px] font-black uppercase tracking-[.18em] text-amber-200 shadow-xl backdrop-blur-xl"><Zap className="mr-1 inline h-3.5 w-3.5" /> {hand?.stage?.toUpperCase() ?? "LOBBY"}</motion.div>
      </div>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-4">
        {["DEAL", "ACTION", "REVEAL", "WIN"].map((step, i) => <div key={step} className="rounded-xl border border-white/8 bg-black/30 p-3"><div className="font-mono text-[7px] font-black uppercase tracking-[.2em] text-amber-200/75">0{i+1} · {step}</div><div className="mt-1 text-[9px] text-white/35">{step === "DEAL" ? "Rozdání karet" : step === "ACTION" ? "Tah a pohyb žetonů" : step === "REVEAL" ? "Flop / turn / river" : "Showdown + pot"}</div></div>)}
      </div>
    </section>
  );
}
