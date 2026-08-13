import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, LogOut, Plus, Timer, Trash2, Users, Sparkles, Crown, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CasinoChat, FlyingEmoji } from "@/components/CasinoChat";
import { CountUp, FxText, MagneticText, TiltCard } from "@/lib/fx";
import {
  applyAction,
  cardLabel,
  communityCards,
  holeCards,
  isRed,
  startHand,
  TURN_SECONDS,
  type Card,
  type HandState,
  type PokerAction,
} from "@/lib/poker";
import { cn } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  buy_in: number;
  starting_chips: number;
  max_players: number;
  status: string;
  hand: HandState | null;
  created_by: string;
}

interface Seat {
  id: string;
  tournament_id: string;
  user_id: string;
  nickname: string;
  seat_no: number;
  chips: number;
}

export function LivePokerTournament() {
  const { user, balance, refreshProfile } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", buyIn: 50, chips: 1000, players: 6 });

  const load = useCallback(async () => {
    const [{ data: t, error: tournamentError }, { data: s }] = await Promise.all([
      // The table no longer exposes the private `hand` column. The RPC returns
      // public tournament state plus only this caller's hole cards.
      supabase.rpc("poker_list_tournaments" as any),
      supabase.from("poker_seats").select("*"),
    ]);
    if (tournamentError) {
      console.error("Poker tournament load error:", tournamentError);
      setTournaments([]);
    } else {
      setTournaments((t ?? []) as unknown as Tournament[]);
    }
    setSeats((s ?? []) as Seat[]);
  }, []);

  useEffect(() => {
    void load();
    // Tournament rows contain private game state, so they are intentionally
    // not subscribed to via Postgres Changes anymore. Poll the sanitized RPC
    // instead; seat changes remain realtime.
    const channel = supabase
      .channel("poker-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load())
      .subscribe();
    const poll = window.setInterval(() => void load(), 2000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [load]);

  const create = async () => {
    if (!user) return toast.error("Pro založení turnaje se přihlas.");
    if (!form.name.trim()) return toast.error("Zadej název turnaje.");
    const { error } = await supabase.rpc("poker_create_tournament", {
      _name: form.name.trim(),
      _buy_in: form.buyIn,
      _starting_chips: form.chips,
      _max_players: form.players,
    });
    if (error) return toast.error("Turnaj nelze vytvořit.");
    toast.success("Turnaj byl úspěšně založen!");
    setCreating(false);
    setForm({ name: "", buyIn: 50, chips: 1000, players: 6 });
    void load();
  };

  const cancelTournament = async (tournamentId: string) => {
    if (!user) return;
    await supabase.rpc("poker_cash_out", { _tournament_id: tournamentId });
    const { error } = await supabase.from("poker_tournaments").delete().eq("id", tournamentId);
    if (error) return toast.error("Turnaj se nepodařilo zrušit.");
    toast.success("Turnaj byl zrušen.");
    if (openId === tournamentId) setOpenId(null);
    void refreshProfile();
    void load();
  };

  const join = async (t: Tournament) => {
    if (!user) return toast.error("Pro připojení se přihlas.");
    if (balance < Number(t.buy_in)) return toast.error("Nedostatek prostředků na buy-in.");
    const { error } = await supabase.rpc("poker_join", { _tournament_id: t.id });
    if (error) return toast.error(error.message.includes("table_full") ? "Stůl je plný." : "Připojení selhalo.");
    void refreshProfile();
    setOpenId(t.id);
  };

  const open = tournaments.find((t) => t.id === openId) ?? null;

  if (open) {
    return (
      <PokerTable
        tournament={open}
        seats={seats.filter((s) => s.tournament_id === open.id).sort((a, b) => a.seat_no - b.seat_no)}
        onLeave={() => setOpenId(null)}
        onRefresh={load}
        onCancel={() => cancelTournament(open.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-black/80 to-slate-950/90 p-6 backdrop-blur-xl shadow-2xl shadow-amber-500/5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-amber-400">
                <Sparkles className="h-3 w-3" /> VIP High Stakes
              </span>
            </div>
            <MagneticText text="TEXAS HOLD'EM POKER" className="font-display text-3xl font-black tracking-wider text-amber-200 sm:text-4xl" />
            <p className="text-xs text-amber-200/60">Připoj se k probíhajícímu stolu nebo založ vlastní turnaj pro přátele.</p>
          </div>
          <button onClick={() => setCreating((v) => !v)} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 font-mono text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95">
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            {creating ? "Zavřít formulář" : "Vytvořit Turnaj"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-3xl border border-amber-500/30 bg-black/80 p-6 backdrop-blur-2xl shadow-xl">
              <h3 className="mb-4 font-mono text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2"><Crown className="h-4 w-4" /> Parametry nového stolu</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Název Turnaje</span><input value={form.name} placeholder="Např. Royal High Rollers" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" /></label>
                <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Buy-In ($)</span><input type="number" min={0} value={form.buyIn} onChange={(e) => setForm((f) => ({ ...f, buyIn: Math.max(0, Number(e.target.value) || 0) }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" /></label>
                <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Startovní Žetony</span><input type="number" min={100} step={100} value={form.chips} onChange={(e) => setForm((f) => ({ ...f, chips: Math.max(100, Number(e.target.value) || 100) }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" /></label>
                <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Kapacita Hráčů (2–9)</span><input type="number" min={2} max={9} value={form.players} onChange={(e) => setForm((f) => ({ ...f, players: Math.min(9, Math.max(2, Number(e.target.value) || 2)) }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" /></label>
              </div>
              <button onClick={create} className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-3 font-mono text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99]">Potvrdit a Založit Turnaj</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.length === 0 && <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 p-12 text-center"><Coins className="h-10 w-10 text-zinc-600 mb-2" /><p className="text-sm font-medium text-zinc-400">Zatím nebyly založeny žádné aktivní turnaje.</p><p className="text-xs text-zinc-600">Buď prvním, kdo vytvoří pokerový stůl!</p></div>}
        {tournaments.map((t) => {
          const mySeats = seats.filter((s) => s.tournament_id === t.id);
          const seated = mySeats.some((s) => s.user_id === user?.id);
          return (
            <TiltCard key={t.id} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black/90 p-5 backdrop-blur-xl transition-all duration-300 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/10">
              <div className="flex items-start justify-between gap-2"><div><FxText glitch className="font-display text-xl font-bold tracking-wide text-amber-100">{t.name}</FxText><div className="mt-1 flex items-center gap-2"><span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 border border-amber-500/20">BUY-IN ${Number(t.buy_in).toFixed(0)}</span><span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-300">{t.starting_chips} Chips</span></div></div><button onClick={() => cancelTournament(t.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20 hover:text-red-300" title="Zrušit turnaj"><Trash2 className="h-4 w-4" /></button></div>
              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4 text-xs"><span className="inline-flex items-center gap-1.5 font-mono text-zinc-400"><Users className="h-3.5 w-3.5 text-amber-400" />{mySeats.length} / {t.max_players} hráčů</span><span className={cn("inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider", t.hand && t.hand.stage !== "done" ? "text-emerald-400" : "text-amber-400/80")}><span className={cn("h-1.5 w-1.5 rounded-full", t.hand && t.hand.stage !== "done" ? "bg-emerald-400 animate-ping" : "bg-amber-400")} />{t.hand && t.hand.stage !== "done" ? "Hra probíhá" : "Čeká v lobby"}</span></div>
              <button onClick={() => (seated ? setOpenId(t.id) : join(t))} className={cn("mt-4 w-full rounded-xl py-2.5 font-mono text-xs font-black uppercase tracking-widest transition-all", seated ? "border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "bg-white/10 text-white hover:bg-amber-500 hover:text-black shadow-lg")}>{seated ? "Vrátit se ke stolu" : "Připojit se ke stolu"}</button>
            </TiltCard>
          );
        })}
      </div>
    </div>
  );
}

function HoleCard({ card, hidden, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  const red = card ? isRed(card) : false;
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: delay / 1000, duration: 0.25 }} className={cn("relative flex h-16 w-11 sm:h-20 sm:w-14 select-none items-center justify-center rounded-xl border text-base font-black shadow-xl backdrop-blur-md transition-all duration-300", hidden || !card ? "border-amber-500/40 bg-gradient-to-br from-amber-950/80 via-black to-zinc-950 text-amber-500/30 shadow-black/80" : red ? "border-red-500/50 bg-gradient-to-b from-zinc-900 to-black text-red-500 shadow-red-950/30" : "border-zinc-300/40 bg-gradient-to-b from-zinc-800 to-black text-zinc-100 shadow-zinc-950/50")}>{hidden || !card ? <div className="flex flex-col items-center opacity-40"><Crown className="h-4 w-4 text-amber-500" /></div> : <span className="font-mono tracking-tighter text-sm sm:text-base drop-shadow-md">{cardLabel(card)}</span>}</motion.div>
  );
}

function PokerTable({ tournament, seats, onLeave, onRefresh, onCancel }: { tournament: Tournament; seats: Seat[]; onLeave: () => void; onRefresh: () => Promise<void> | void; onCancel: () => void; }) {
  const { user, refreshProfile } = useAuth();
  const hand = tournament.hand;
  const [emojis, setEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const [raise, setRaise] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 500); return () => clearInterval(t); }, []);

  const mySeatNo = seats.find((s) => s.user_id === user?.id)?.seat_no ?? -1;
  const seated = mySeatNo >= 0;

  const pushHand = useCallback(async (next: HandState) => {
    const { error } = await supabase.from("poker_tournaments").update({ hand: next as unknown as never, status: next.stage === "done" ? "lobby" : "running" }).eq("id", tournament.id);
    if (error) { console.error("Supabase Hand Update Error:", error); toast.error(`Chyba při ukládání hry: ${error.message}`); return; }
    void onRefresh();
  }, [tournament.id, onRefresh]);

  const deal = useCallback(async () => {
    if (seats.length < 2) { toast.error("Ke spuštění hry jsou potřeba alespoň 2 hráči u stolu."); return; }
    try {
      const dealer = hand ? (hand.dealer + 1) % seats.length : 0;
      const next = startHand(seats.map((s) => ({ userId: s.user_id, nickname: s.nickname, chips: s.chips })), dealer, Math.max(5, Math.round(tournament.starting_chips / 100)));
      await pushHand(next);
    } catch (err: any) { console.error("Deal error:", err); toast.error("Selhalo generování karet."); }
  }, [seats, hand, tournament.starting_chips, pushHand]);

  const act = async (action: PokerAction, amount = 0) => { if (!hand || !user) return; const next = applyAction(hand, user.id, action, amount); await pushHand(next); };

  const cashOut = async () => {
    const { error } = await supabase.rpc("poker_cash_out", { _tournament_id: tournament.id });
    if (error) return toast.error("Odchod od stolu selhal.");
    toast.success("Žetony vyplaceny do peněženky");
    void refreshProfile();
    void onRefresh();
    onLeave();
  };

  const me = hand?.players.find((p) => p.userId === user?.id) ?? null;
  const myTurn = !!hand && hand.stage !== "done" && hand.players[hand.toAct]?.userId === user?.id;
  const toCall = hand && me ? Math.max(0, hand.currentBet - me.bet) : 0;
  const board = useMemo(() => (hand ? communityCards(hand) : []), [hand]);
  const secondsLeft = hand ? Math.max(0, Math.ceil((hand.deadline - Date.now()) / 1000)) : 0;

  useEffect(() => { if (hand && me) setRaise(Math.min(me.chips + me.bet, hand.currentBet + hand.minRaise)); }, [hand?.currentBet, hand?.stage]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
          <div><span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Buy-In ${Number(tournament.buy_in).toFixed(0)}</span><h2 className="font-display text-2xl font-bold text-white tracking-wide">{tournament.name}</h2></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onLeave} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-zinc-300 hover:bg-white/10 transition">ZPĚT DO LOBBY</button>
            <button onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/20 px-3 py-2 font-mono text-xs font-bold text-red-400 hover:bg-red-500/30 transition shadow-lg shadow-red-500/10"><Trash2 className="h-3.5 w-3.5" /> ZRUŠIT TURNAJ</button>
            {seated && <button onClick={cashOut} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition"><LogOut className="h-3.5 w-3.5" /> CASH OUT</button>}
            {(!hand || hand.stage === "done") && <button onClick={deal} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 font-mono text-xs font-black text-black hover:brightness-110 shadow-lg shadow-amber-500/20 transition"><Play className="h-3.5 w-3.5 fill-black" /> ROZDAT KARTY</button>}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] border-4 border-amber-950/60 bg-emerald-950 p-6 sm:p-10 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)] ring-1 ring-amber-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-800/40 via-emerald-950/90 to-black pointer-events-none" />
          <FlyingEmoji items={emojis} />
          <div className="relative z-10 flex flex-col items-center justify-center gap-4 py-4">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-950/80 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-300 backdrop-blur-md shadow-lg">{hand ? hand.stage.toUpperCase() : `ČEKÁ NA HRÁČE (${seats.length}/${tournament.max_players})`}</span>
            <div className="flex items-center justify-center gap-2 sm:gap-3 my-2">{Array.from({ length: 5 }, (_, i) => <HoleCard key={i} card={board[i]} hidden={!board[i]} delay={i * 90} />)}</div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-black/80 px-5 py-2 font-mono text-sm font-black text-amber-400 shadow-2xl backdrop-blur-xl"><Coins className="h-5 w-5 text-amber-400 animate-bounce" /> POT: <CountUp value={hand?.pot ?? 0} /></div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seats.map((s) => {
              const p = hand?.players.find((x) => x.userId === s.user_id) ?? null;
              const isTurn = !!hand && hand.stage !== "done" && hand.players[hand.toAct]?.userId === s.user_id;
              const mine = s.user_id === user?.id;
              const winner = hand?.winners?.some((w) => w.userId === s.user_id);
              return (
                <div key={s.id} className={cn("relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 backdrop-blur-md", isTurn ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20" : winner ? "border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400" : "border-white/10 bg-black/60", p?.folded && "opacity-40 grayscale")}>
                  <div className="flex items-center justify-between"><span className="font-display font-bold text-sm text-zinc-100">{s.nickname}</span>{isTurn && <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-400 animate-pulse"><Timer className="h-3 w-3" /> {Math.min(secondsLeft, TURN_SECONDS)}s</span>}</div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-zinc-400"><span>Chips: <CountUp value={p?.chips ?? s.chips} className="text-amber-400 font-bold" /></span>{p && p.bet > 0 && <span className="text-emerald-400 font-bold">Bet: ${p.bet}</span>}{p?.allIn && <span className="rounded bg-red-500/20 px-1 py-0.5 text-[9px] font-black text-red-400 border border-red-500/30">ALL-IN</span>}</div>
                  <div className="mt-3 flex gap-2 justify-center">
                    {hand ? holeCards(hand, seats.findIndex((x) => x.id === s.id)).map((c, i) => <HoleCard key={i} card={c} hidden={!mine && hand.stage !== "done"} delay={i * 120} />) : <><HoleCard hidden /><HoleCard hidden /></>}
                  </div>
                  {winner && <div className="mt-2 text-center rounded-lg bg-emerald-500/20 py-1 font-mono text-[10px] font-black uppercase text-emerald-300 border border-emerald-500/30">🏆 Vítěz · {hand?.winners?.find((w) => w.userId === s.user_id)?.label}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {seated && hand && hand.stage !== "done" && (
          <div className="rounded-3xl border border-white/10 bg-black/90 p-4 backdrop-blur-xl flex flex-wrap items-center gap-3">
            <button disabled={!myTurn} onClick={() => act("fold")} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition">Fold</button>
            <button disabled={!myTurn || toCall > 0} onClick={() => act("check")} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 disabled:opacity-30 transition">Check</button>
            <button disabled={!myTurn || toCall === 0} onClick={() => act("call")} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 disabled:opacity-30 transition">Call {toCall > 0 ? `$${toCall}` : ""}</button>
            <div className="flex min-w-[200px] flex-1 items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5"><input type="range" min={hand.currentBet + hand.minRaise} max={(me?.chips ?? 0) + (me?.bet ?? 0)} value={raise} onChange={(e) => setRaise(Number(e.target.value))} disabled={!myTurn} className="flex-1 accent-amber-500 cursor-pointer" /><span className="w-16 font-mono text-xs font-bold text-amber-400 text-right">${raise}</span></div>
            <button disabled={!myTurn} onClick={() => act("raise", raise)} className="rounded-xl bg-amber-500 px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-black hover:brightness-110 disabled:opacity-30 transition shadow-lg shadow-amber-500/20">Raise</button>
            <button disabled={!myTurn} onClick={() => act("allin")} className="rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-30 transition shadow-lg shadow-red-600/30">All-In</button>
          </div>
        )}

        {hand && <div className="rounded-2xl border border-white/5 bg-black/60 p-3 max-h-36 overflow-y-auto font-mono text-[11px] text-zinc-400 space-y-1">{hand.log.slice(-14).map((l, i) => <p key={i} className="border-b border-white/5 pb-0.5 last:border-none">{l}</p>)}</div>}
      </div>

      <div className="h-full"><CasinoChat room={`poker-${tournament.id}`} onEmoji={(_n, emoji) => { const id = Date.now() + Math.random(); setEmojis((prev) => [...prev, { id, emoji }]); setTimeout(() => setEmojis((prev) => prev.filter((e) => e.id !== id)), 1700); }} /></div>
    </div>
  );
}
