import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CasinoChat, FlyingEmoji } from "@/components/CasinoChat";
import { CountUp, FxText, MagneticText, TiltCard } from "@/lib/fx";
import { cn } from "@/lib/utils";

/** Evropské kolo (37 pozic) */
const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26,
];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROUND_SEC = 15;

type BetType = "red" | "black" | "green" | "even" | "odd" | "low" | "high" | "dozen" | "number";
interface Row {
  id: string;
  round_no: number;
  nickname: string;
  bet_type: string;
  bet_value: string | null;
  amount: number;
  payout: number | null;
}

const roundNow = () => Math.floor(Date.now() / 1000 / ROUND_SEC);
const colorOf = (n: number) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");

/** Živá multiplayer ruleta — 15s kola sdílená všemi hráči. */
export function LiveRoulette() {
  const { user, nickname, balance, refreshProfile } = useAuth();
  const [round, setRound] = useState(roundNow());
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SEC);
  const [bets, setBets] = useState<Row[]>([]);
  const [lastRound, setLastRound] = useState<{ round: number; result: number; winners: Row[] } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<{ type: BetType; value?: string }>({ type: "red" });
  const [stake, setStake] = useState(10);
  const [emojis, setEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const settledRef = useRef<number | null>(null);

  /* ---- odpočet + přechod kola ---- */
  useEffect(() => {
    const t = setInterval(() => {
      const r = roundNow();
      setSecondsLeft(ROUND_SEC - (Math.floor(Date.now() / 1000) % ROUND_SEC));
      setRound((prev) => {
        if (r !== prev) void settle(prev);
        return r;
      });
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- sázky aktuálního kola + realtime ---- */
  const loadBets = useCallback(async (r: number) => {
    const { data } = await supabase
      .from("roulette_bets")
      .select("id,round_no,nickname,bet_type,bet_value,amount,payout")
      .eq("round_no", r)
      .order("created_at", { ascending: true });
    setBets((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void loadBets(round);
  }, [round, loadBets]);

  useEffect(() => {
    const channel = supabase
      .channel("roulette-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "roulette_bets" }, (payload) => {
        const row = (payload.new ?? payload.old) as Row;
        if (row?.round_no === roundNow()) void loadBets(roundNow());
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBets]);

  const spinTo = useCallback((result: number) => {
    const idx = WHEEL.indexOf(result);
    const step = 360 / WHEEL.length;
    setSpinning(true);
    setAngle((a) => a + 360 * 5 + (360 - idx * step) - (a % 360));
    setTimeout(() => setSpinning(false), 4200);
  }, []);

  /* ---- vyhodnocení uzavřeného kola ---- */
  const settle = useCallback(
    async (prevRound: number) => {
      if (settledRef.current === prevRound) return;
      settledRef.current = prevRound;
      if (!user) return;
      const { data, error } = await supabase.rpc("roulette_settle", { _round_no: prevRound });
      if (error) return;
      const result = (data as { result: number } | null)?.result;
      if (typeof result !== "number") return;
      spinTo(result);
      setHistory((h) => [result, ...h].slice(0, 12));
      const { data: rows } = await supabase
        .from("roulette_bets")
        .select("id,round_no,nickname,bet_type,bet_value,amount,payout")
        .eq("round_no", prevRound);
      const all = (rows ?? []) as Row[];
      setLastRound({ round: prevRound, result, winners: all.filter((b) => Number(b.payout) > 0) });
      const mine = all.filter((b) => b.nickname === nickname && Number(b.payout) > 0);
      if (mine.length) {
        const won = mine.reduce((s, b) => s + Number(b.payout), 0);
        toast.success(`🎉 Ruleta: padlo ${result} — výhra $${won.toFixed(0)}`);
      }
      void refreshProfile();
    },
    [user, nickname, refreshProfile, spinTo],
  );

  const myBets = useMemo(() => bets.filter((b) => b.nickname === nickname), [bets, nickname]);
  const pool = useMemo(() => bets.reduce((s, b) => s + Number(b.amount), 0), [bets]);

  const place = async () => {
    if (!user) return toast.error("Pro sázení se přihlas.");
    if (stake < 1) return toast.error("Minimální sázka je $1.");
    if (stake > balance) return toast.error("Nedostatek prostředků.");
    const { error } = await supabase.rpc("roulette_place_bet", {
      _round_no: roundNow(),
      _bet_type: selected.type,
      _bet_value: selected.value ?? "",
      _amount: stake,
    });
    if (error) {
      toast.error(error.message.includes("round_closed") ? "Kolo je uzavřené, zkus další." : "Sázku nelze umístit.");
      return;
    }
    toast.success(`Sázka $${stake} přijata`);
    void refreshProfile();
    void loadBets(roundNow());
  };

  const chip = (type: BetType, value?: string, label?: string, cls?: string) => {
    const active = selected.type === type && selected.value === value;
    return (
      <button
        key={`${type}-${value ?? ""}`}
        onClick={() => setSelected({ type, value })}
        className={cn(
          "fx-text rounded-lg border px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition",
          active ? "border-primary bg-primary/25 text-primary" : "border-border/60 bg-black/40 text-foreground/75",
          cls,
        )}
      >
        {label ?? value ?? type}
      </button>
    );
  };

  const step = 360 / WHEEL.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        {/* Kolo */}
        <TiltCard className="glass relative overflow-hidden p-5" intensity={6}>
          <FlyingEmoji items={emojis} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Live ruleta · kolo #{round}</p>
              <MagneticText text="NEON ROULETTE" className="font-display text-3xl tracking-[0.12em] text-primary sm:text-4xl" />
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary">
                <Timer className="h-4 w-4" /> {spinning ? "SPIN" : `${secondsLeft}s`}
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent">
                <Coins className="h-4 w-4" /> pool <CountUp value={pool} prefix="$" />
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center">
            <div className="relative h-[260px] w-[260px] sm:h-[320px] sm:w-[320px]">
              <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
                <div className="h-6 w-1.5 rounded-full bg-primary shadow-[0_0_18px_var(--color-primary)]" />
              </div>
              <motion.div
                animate={{ rotate: angle }}
                transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }}
                className="wheel-glow absolute inset-0 rounded-full border border-primary/40"
                style={{
                  background: `conic-gradient(${WHEEL.map((n, i) => {
                    const c = colorOf(n) === "green" ? "#10b981" : colorOf(n) === "red" ? "#e11d48" : "#0b0b12";
                    return `${c} ${i * step}deg ${(i + 1) * step}deg`;
                  }).join(",")})`,
                }}
              >
                {WHEEL.map((n, i) => (
                  <span
                    key={n}
                    className="absolute left-1/2 top-1/2 font-mono text-[9px] font-bold text-white/90"
                    style={{ transform: `rotate(${i * step + step / 2}deg) translateY(-46%) ` }}
                  >
                    {n}
                  </span>
                ))}
              </motion.div>
              <div className="absolute inset-[26%] rounded-full border border-primary/40 bg-black/85 backdrop-blur-xl">
                <div className="flex h-full flex-col items-center justify-center">
                  <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Poslední</p>
                  <FxText
                    glitch
                    className={cn(
                      "font-display text-4xl",
                      lastRound
                        ? colorOf(lastRound.result) === "red"
                          ? "text-danger"
                          : colorOf(lastRound.result) === "green"
                            ? "text-accent"
                            : "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {lastRound ? lastRound.result : "—"}
                  </FxText>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {history.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold",
                    colorOf(n) === "red" ? "bg-danger/25 text-danger" : colorOf(n) === "green" ? "bg-accent/25 text-accent" : "bg-white/10",
                  )}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </TiltCard>

        {/* Sázkový stůl */}
        <div className="glass fx-spotlight space-y-3 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">Sázkový stůl</p>
          <div className="flex flex-wrap gap-2">
            {chip("red", undefined, "Červená 2×", "border-danger/50 text-danger")}
            {chip("black", undefined, "Černá 2×")}
            {chip("green", undefined, "Zelená 0 · 36×", "border-accent/50 text-accent")}
            {chip("even", undefined, "Sudá 2×")}
            {chip("odd", undefined, "Lichá 2×")}
            {chip("low", undefined, "1–18")}
            {chip("high", undefined, "19–36")}
            {chip("dozen", "1", "1. tucet 3×")}
            {chip("dozen", "2", "2. tucet 3×")}
            {chip("dozen", "3", "3. tucet 3×")}
          </div>

          <div className="grid grid-cols-9 gap-1 sm:grid-cols-12">
            {Array.from({ length: 37 }, (_, n) => {
              const active = selected.type === "number" && selected.value === String(n);
              return (
                <button
                  key={n}
                  onClick={() => setSelected({ type: "number", value: String(n) })}
                  className={cn(
                    "rounded-md py-1.5 font-mono text-[10px] font-bold transition hover:scale-110",
                    colorOf(n) === "red" ? "bg-danger/25 text-danger" : colorOf(n) === "green" ? "bg-accent/25 text-accent" : "bg-white/10",
                    active && "ring-2 ring-primary",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[10, 100, 500].map((q) => (
              <button
                key={q}
                onClick={() => setStake((s) => s + q)}
                className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[11px] text-primary"
              >
                +${q}
              </button>
            ))}
            <button
              onClick={() => setStake(Math.max(1, Math.floor(balance)))}
              className="rounded-lg border border-danger/50 bg-danger/15 px-3 py-2 font-mono text-[11px] font-black uppercase tracking-widest text-danger"
            >
              Max / all-in
            </button>
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-border/60 bg-black/40 px-2 py-2 font-mono text-sm"
            />
            <button
              onClick={place}
              disabled={!user || spinning}
              className="rounded-xl border border-primary bg-primary/20 px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-primary disabled:opacity-40"
            >
              Vsadit ${stake}
            </button>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              zůstatek <CountUp value={balance} prefix="$" className="text-primary" />
            </span>
          </div>
        </div>

        {/* Žetony u stolu */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Žetony v kole</p>
            <ul className="mt-2 space-y-1 text-xs">
              {bets.length === 0 && <li className="text-muted-foreground">Kolo je zatím bez sázek.</li>}
              {bets.map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span className="fx-text text-accent">{b.nickname}</span>
                  <span className="font-mono">
                    {b.bet_type}
                    {b.bet_value ? ` ${b.bet_value}` : ""} · ${Number(b.amount).toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
            {myBets.length > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                tvé sázky: ${myBets.reduce((s, b) => s + Number(b.amount), 0).toFixed(0)}
              </p>
            )}
          </div>
          <div className="glass p-4">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <Trophy className="h-3.5 w-3.5" /> Výherci kola #{lastRound?.round ?? "—"}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {!lastRound?.winners.length && <li className="text-muted-foreground">Zatím bez výherců.</li>}
              {lastRound?.winners.map((w) => (
                <li key={w.id} className="flex items-center justify-between">
                  <span className="fx-text fx-glitch text-primary">{w.nickname}</span>
                  <span className="font-mono text-accent">+${Number(w.payout).toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <CasinoChat
        room="roulette"
        onEmoji={(_n, emoji) => {
          const id = Date.now() + Math.random();
          setEmojis((prev) => [...prev, { id, emoji }]);
          setTimeout(() => setEmojis((prev) => prev.filter((e) => e.id !== id)), 1700);
        }}
      />
    </div>
  );
}
