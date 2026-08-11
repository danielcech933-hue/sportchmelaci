import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins, LogOut, Plus, Timer, Trash2, Users } from "lucide-react";
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

/** Online poker turnaje — Texas Hold'em u neonového stolu. */
export function LivePokerTournament() {
  const { user, balance, refreshProfile } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", buyIn: 50, chips: 1000, players: 6 });

  const load = useCallback(async () => {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from("poker_tournaments").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("poker_seats").select("*"),
    ]);
    setTournaments((t ?? []) as unknown as Tournament[]);
    setSeats((s ?? []) as Seat[]);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("poker-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "poker_tournaments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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
    toast.success("Turnaj vytvořen");
    setCreating(false);
    setForm({ name: "", buyIn: 50, chips: 1000, players: 6 });
    void load();
  };

  const cancelTournament = async (tournamentId: string) => {
    if (!user) return;

    // Odhlášení/vrácení chipů pokud byl hráč připojen
    await supabase.rpc("poker_cash_out", { _tournament_id: tournamentId });

    const { error } = await supabase.from("poker_tournaments").delete().eq("id", tournamentId);
    if (error) {
      toast.error("Turnaj se nepodařilo zrušit.");
      return;
    }

    toast.success("Turnaj byl úspěšně zrušen.");
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
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Texas Hold'em</p>
          <MagneticText
            text="POKER TURNAJE"
            className="font-display text-3xl tracking-[0.12em] text-primary sm:text-4xl"
          />
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/15 px-3 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-primary"
        >
          <Plus className="h-4 w-4" /> Nový turnaj
        </button>
      </div>

      {creating && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass grid gap-3 p-4 sm:grid-cols-4"
        >
          <label className="text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Název</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border/60 bg-black/40 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Buy-in ($)</span>
            <input
              type="number"
              min={0}
              value={form.buyIn}
              onChange={(e) => setForm((f) => ({ ...f, buyIn: Math.max(0, Number(e.target.value) || 0) }))}
              className="mt-1 w-full rounded-lg border border-border/60 bg-black/40 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Starting chips
            </span>
            <input
              type="number"
              min={100}
              step={100}
              value={form.chips}
              onChange={(e) => setForm((f) => ({ ...f, chips: Math.max(100, Number(e.target.value) || 100) }))}
              className="mt-1 w-full rounded-lg border border-border/60 bg-black/40 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hráčů (2–9)</span>
            <input
              type="number"
              min={2}
              max={9}
              value={form.players}
              onChange={(e) =>
                setForm((f) => ({ ...f, players: Math.min(9, Math.max(2, Number(e.target.value) || 2)) }))
              }
              className="mt-1 w-full rounded-lg border border-border/60 bg-black/40 px-2 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-4">
            <button
              onClick={create}
              className="rounded-xl border border-accent/50 bg-accent/15 px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-accent"
            >
              Založit turnaj
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.length === 0 && (
          <p className="text-sm text-muted-foreground">Zatím žádné turnaje — založ první.</p>
        )}
        {tournaments.map((t) => {
          const mySeats = seats.filter((s) => s.tournament_id === t.id);
          const seated = mySeats.some((s) => s.user_id === user?.id);
          const isCreator = t.created_by === user?.id;

          return (
            <TiltCard key={t.id} className="glass relative p-4" intensity={8}>
              <div className="flex items-start justify-between">
                <FxText glitch className="font-display text-xl tracking-[0.1em] text-primary">
                  {t.name}
                </FxText>
                {isCreator && (
                  <button
                    onClick={() => cancelTournament(t.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-danger/20 hover:text-danger transition"
                    title="Zrušit turnaj"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-foreground/80">
                <span>buy-in ${Number(t.buy_in).toFixed(0)}</span>
                <span>{t.starting_chips} chips</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {mySeats.length}/{t.max_players}
                </span>
                <span className="text-accent">{t.hand && t.hand.stage !== "done" ? "hra běží" : "čeká"}</span>
              </div>
              <button
                onClick={() => (seated ? setOpenId(t.id) : join(t))}
                className="mt-3 w-full rounded-xl border border-primary/50 bg-primary/15 px-3 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-primary"
              >
                {seated ? "Zpět ke stolu" : "Připojit se ke stolu"}
              </button>
            </TiltCard>
          );
        })}
      </div>
    </div>
  );
}

/* ================= STŮL ================= */

function HoleCard({ card, hidden, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  return (
    <div
      className={cn(
        "holo-card flex h-14 w-10 items-center justify-center rounded-md border font-mono text-sm font-black backdrop-blur-md sm:h-16 sm:w-11",
        hidden || !card
          ? "border-primary/40 bg-[linear-gradient(135deg,rgba(255,204,68,0.25),rgba(0,0,0,0.85))] text-primary/40"
          : isRed(card)
            ? "border-danger/60 bg-black/70 text-danger"
            : "border-white/40 bg-black/70 text-foreground",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {hidden || !card ? "🍺" : cardLabel(card)}
    </div>
  );
}

function PokerTable({
  tournament,
  seats,
  onLeave,
  onRefresh,
  onCancel,
}: {
  tournament: Tournament;
  seats: Seat[];
  onLeave: () => void;
  onRefresh: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const { user, refreshProfile } = useAuth();
  const hand = tournament.hand;
  const [emojis, setEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const [raise, setRaise] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  const mySeatNo = seats.find((s) => s.user_id === user?.id)?.seat_no ?? -1;
  const seated = mySeatNo >= 0;
  const isCreator = tournament.created_by === user?.id;

  const pushHand = useCallback(
    async (next: HandState) => {
      await supabase
        .from("poker_tournaments")
        .update({ hand: next as unknown as never, status: next.stage === "done" ? "lobby" : "running" })
        .eq("id", tournament.id);
      if (next.stage === "done") {
        const stacks: Record<string, number> = {};
        next.players.forEach((p) => {
          stacks[p.userId] = p.chips;
        });
        await supabase.rpc("poker_sync_chips", { _tournament_id: tournament.id, _stacks: stacks });
      }
      void onRefresh();
    },
    [tournament.id, onRefresh],
  );

  const deal = useCallback(async () => {
    if (seats.length < 2) {
      toast.error("Ke spuštění hry jsou potřeba alespoň 2 hráči.");
      return;
    }
    const dealer = hand ? (hand.dealer + 1) % seats.length : 0;
    const next = startHand(
      seats.map((s) => ({ userId: s.user_id, nickname: s.nickname, chips: s.chips })),
      dealer,
      Math.max(5, Math.round(tournament.starting_chips / 100)),
    );
    await pushHand(next);
  }, [seats, hand, tournament.starting_chips, pushHand]);

  /* ---- AUTOMATICKÝ START A AUTOMATICKÉ ROZDÁVÁNÍ ---- */
  useEffect(() => {
    // 1. Automaticky začít, když se naplní stůl
    const isFull = seats.length >= tournament.max_players;
    const noHandRunning = !hand || hand.stage === "done";

    if (isFull && noHandRunning && isCreator) {
      void deal();
    }

    // 2. Automaticky rozdat další kolo po dohrání
    if (hand && hand.stage === "done" && seats.length >= 2 && isCreator) {
      const timer = setTimeout(() => {
        void deal();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [seats.length, tournament.max_players, hand, isCreator, deal]);

  const act = async (action: PokerAction, amount = 0) => {
    if (!hand || !user) return;
    const next = applyAction(hand, user.id, action, amount);
    await pushHand(next);
  };

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

  useEffect(() => {
    if (hand && me) setRaise(Math.min(me.chips + me.bet, hand.currentBet + hand.minRaise));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand?.currentBet, hand?.stage]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
              Stůl · buy-in ${Number(tournament.buy_in).toFixed(0)}
            </p>
            <MagneticText
              text={tournament.name.toUpperCase()}
              className="font-display text-2xl tracking-[0.1em] text-primary sm:text-3xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onLeave}
              className="rounded-xl border border-border/60 px-3 py-2 font-mono text-[11px] uppercase tracking-widest"
            >
              Zpět do lobby
            </button>
            {isCreator && (
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-danger hover:bg-danger/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Zrušit turnaj
              </button>
            )}
            {seated && (
              <button
                onClick={cashOut}
                className="inline-flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/15 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-danger"
              >
                <LogOut className="h-3.5 w-3.5" /> Cash out
              </button>
            )}
            {(!hand || hand.stage === "done") && seated && (
              <button
                onClick={deal}
                className="rounded-xl border border-primary bg-primary/20 px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-primary"
              >
                Rozdat karty
              </button>
            )}
          </div>
        </div>

        <div className="felt relative overflow-hidden rounded-[2rem] p-6">
          <FlyingEmoji items={emojis} />
          {/* Community */}
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
              {hand ? hand.stage.toUpperCase() : `ČEKÁ NA HRÁČE (${seats.length}/${tournament.max_players})`}
            </p>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <HoleCard key={i} card={board[i]} hidden={!board[i]} delay={i * 90} />
              ))}
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-black/50 px-3 py-1.5 font-mono text-xs text-primary">
              <Coins className="h-4 w-4" /> pot <CountUp value={hand?.pot ?? 0} />
            </div>
          </div>

          {/* Hráči */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seats.map((s) => {
              const p = hand?.players.find((x) => x.userId === s.user_id) ?? null;
              const isTurn = !!hand && hand.stage !== "done" && hand.players[hand.toAct]?.userId === s.user_id;
              const mine = s.user_id === user?.id;
              const winner = hand?.winners?.some((w) => w.userId === s.user_id);
              return (
                <TiltCard
                  key={s.id}
                  intensity={9}
                  className={cn(
                    "glass relative p-3",
                    isTurn && "ring-2 ring-primary animate-pulse-glow",
                    winner && "ring-2 ring-accent",
                    p?.folded && "opacity-45",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <FxText glitch className="font-display text-lg tracking-wide text-primary">
                      {s.nickname}
                    </FxText>
                    {isTurn && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-danger">
                        <Timer className="h-3 w-3" /> {Math.min(secondsLeft, TURN_SECONDS)}s
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-foreground/80">
                    <span>
                      chips <CountUp value={p?.chips ?? s.chips} className="text-accent" />
                    </span>
                    {p && p.bet > 0 && <span className="text-primary">bet {p.bet}</span>}
                    {p?.allIn && <span className="text-danger">ALL-IN</span>}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {hand ? (
                      holeCards(
                        hand,
                        seats.findIndex((x) => x.id === s.id),
                      ).map((c, i) => (
                        <HoleCard key={i} card={c} hidden={!mine && hand.stage !== "done"} delay={i * 120} />
                      ))
                    ) : (
                      <>
                        <HoleCard hidden />
                        <HoleCard hidden />
                      </>
                    )}
                  </div>
                  {winner && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-accent">
                      vítěz · {hand?.winners?.find((w) => w.userId === s.user_id)?.label}
                    </p>
                  )}
                </TiltCard>
              );
            })}
          </div>
        </div>

        {/* Ovládací panel */}
        {seated && hand && hand.stage !== "done" && (
          <div className="glass fx-spotlight flex flex-wrap items-center gap-2 p-4">
            <button
              disabled={!myTurn}
              onClick={() => act("fold")}
              className="rounded-xl border border-danger/50 bg-danger/15 px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-danger disabled:opacity-40"
            >
              Fold
            </button>
            <button
              disabled={!myTurn || toCall > 0}
              onClick={() => act("check")}
              className="rounded-xl border border-border/60 px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
            >
              Check
            </button>
            <button
              disabled={!myTurn || toCall === 0}
              onClick={() => act("call")}
              className="rounded-xl border border-accent/50 bg-accent/15 px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-accent disabled:opacity-40"
            >
              Call {toCall > 0 ? toCall : ""}
            </button>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <input
                type="range"
                min={hand.currentBet + hand.minRaise}
                max={(me?.chips ?? 0) + (me?.bet ?? 0)}
                value={raise}
                onChange={(e) => setRaise(Number(e.target.value))}
                disabled={!myTurn}
                className="flex-1 accent-[var(--color-primary)]"
              />
              <span className="w-16 font-mono text-xs text-primary">{raise}</span>
            </div>
            <button
              disabled={!myTurn}
              onClick={() => act("raise", raise)}
              className="rounded-xl border border-primary bg-primary/20 px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-primary disabled:opacity-40"
            >
              Raise
            </button>
            <button
              disabled={!myTurn}
              onClick={() => act("allin")}
              className="rounded-xl border border-primary bg-[linear-gradient(90deg,rgba(255,204,68,0.35),rgba(77,255,166,0.25))] px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-primary disabled:opacity-40"
            >
              All-in
            </button>
          </div>
        )}

        {hand && (
          <div className="glass max-h-40 overflow-y-auto p-4 font-mono text-[11px] text-foreground/75">
            {hand.log.slice(-14).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        )}
      </div>

      <CasinoChat
        room={`poker-${tournament.id}`}
        onEmoji={(_n, emoji) => {
          const id = Date.now() + Math.random();
          setEmojis((prev) => [...prev, { id, emoji }]);
          setTimeout(() => setEmojis((prev) => prev.filter((e) => e.id !== id)), 1700);
        }}
      />
    </div>
  );
}
