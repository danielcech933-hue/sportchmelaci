import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Coins, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CasinoChat, FlyingEmoji } from "@/components/CasinoChat";
import { CountUp, FxText, MagneticText, TiltCard } from "@/lib/fx";
import { cn } from "@/lib/utils";

/** Evropské kolo (37 pozic) */
const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
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

export function LiveRoulette() {
  const { user, nickname, balance, refreshProfile } = useAuth();
  const [round, setRound] = useState(roundNow());
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SEC);
  const [bets, setBets] = useState<Row[]>([]);
  const [lastRound, setLastRound] = useState<{ round: number; result: number; winners: Row[] } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<{ type: BetType; value?: string }>({ type: "red" });
  const [stake, setStake] = useState(10);
  const [emojis, setEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const settledRef = useRef<number | null>(null);

  const ballControls = useAnimation();

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

  /* ---- Simulace fyziky kuličky a rotočení rulety ---- */
  const spinTo = useCallback(
    (result: number) => {
      const idx = WHEEL.indexOf(result);
      const step = 360 / WHEEL.length;

      // Cílový úhel rulety (5 plných otáček + offset čísla)
      const targetWheelAngle = wheelAngle + 360 * 5 + (360 - idx * step) - (wheelAngle % 360);

      setSpinning(true);
      setWheelAngle(targetWheelAngle);

      // Animace kuličky - točí se protisměru rulety a padá do středu
      void ballControls.start({
        rotate: [-360 * 8, 0],
        scale: [1, 1, 0.95, 0.82],
        transition: {
          duration: 4.2,
          ease: [0.15, 0.85, 0.35, 1],
        },
      });

      setTimeout(() => {
        setSpinning(false);
      }, 4200);
    },
    [wheelAngle, ballControls],
  );

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
          active
            ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
            : "border-border/60 bg-black/50 text-foreground/75 hover:bg-white/5",
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
        {/* Hlavní aréna s ruletou */}
        <TiltCard
          className="glass relative overflow-hidden p-5 sm:p-7 border-amber-500/20 bg-gradient-to-b from-neutral-950 via-neutral-900 to-black"
          intensity={4}
        >
          <FlyingEmoji items={emojis} />

          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-400/90 font-bold">
                Live ruleta · kolo #{round}
              </p>
              <MagneticText
                text="ROYAL ROULETTE"
                className="font-display text-3xl tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 sm:text-4xl drop-shadow-[0_2px_10px_rgba(245,158,11,0.2)]"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-300 backdrop-blur-md">
                <Timer className="h-4 w-4 text-amber-400" /> {spinning ? "RÁNO " : `${secondsLeft}s`}
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400 backdrop-blur-md">
                <Coins className="h-4 w-4 text-emerald-400" /> pool <CountUp value={pool} prefix="$" />
              </span>
            </div>
          </div>

          <div className="mt-6 mb-2 flex flex-col items-center justify-center relative perspective-[1000px]">
            {/* Vnější dekorační záře */}
            <div className="absolute h-[310px] w-[310px] sm:h-[370px] sm:w-[370px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

            {/* Vnější stříbrno-zlatý rám kolesa (Bezel) */}
            <div className="relative flex items-center justify-center h-[300px] w-[300px] sm:h-[360px] sm:w-[360px] rounded-full p-2.5 bg-gradient-to-b from-amber-200 via-neutral-700 to-amber-600 shadow-[0_15px_35px_rgba(0,0,0,0.9),inset_0_2px_5px_rgba(255,255,255,0.4)] border border-amber-300/30">
              {/* Vnitřní drážka s tmavým efektem */}
              <div className="relative h-full w-full rounded-full bg-neutral-950 p-1.5 shadow-[inset_0_5px_15px_rgba(0,0,0,0.95)]">
                {/* ROTUJÍCÍ KOLO */}
                <motion.div
                  animate={{ rotate: wheelAngle }}
                  transition={{ duration: 4.2, ease: [0.15, 0.85, 0.35, 1] }}
                  className="relative h-full w-full rounded-full overflow-hidden border border-amber-500/40 shadow-2xl"
                  style={{
                    background: `conic-gradient(${WHEEL.map((n, i) => {
                      const c = colorOf(n) === "green" ? "#059669" : colorOf(n) === "red" ? "#dc2626" : "#111116";
                      return `${c} ${i * step}deg ${(i + 1) * step}deg`;
                    }).join(",")})`,
                  }}
                >
                  {/* Dělící drážky/paprsky mezi políčky (Fret lines) */}
                  {WHEEL.map((_, i) => (
                    <div
                      key={`line-${i}`}
                      className="absolute top-0 left-1/2 w-[1px] h-1/2 bg-gradient-to-b from-amber-200/50 via-white/20 to-transparent origin-bottom"
                      style={{
                        transform: `translateX(-50%) rotate(${i * step}deg)`,
                      }}
                    />
                  ))}

                  {/* Čísla na výsečích */}
                  {WHEEL.map((n, i) => {
                    const midAngleDeg = i * step + step / 2;
                    const midAngleRad = (midAngleDeg - 90) * (Math.PI / 180);
                    const radiusPercent = 41;
                    const leftPos = 50 + radiusPercent * Math.cos(midAngleRad);
                    const topPos = 50 + radiusPercent * Math.sin(midAngleRad);

                    return (
                      <span
                        key={n}
                        className="absolute font-mono text-[10px] sm:text-[11px] font-black tracking-tighter text-amber-100 select-none"
                        style={{
                          left: `${leftPos}%`,
                          top: `${topPos}%`,
                          transform: `translate(-50%, -50%) rotate(${midAngleDeg + 90}deg)`,
                          textShadow: "0px 1px 3px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.9)",
                        }}
                      >
                        {n}
                      </span>
                    );
                  })}
                </motion.div>

                {/* ANIMOVANÁ DRÁHA KULIČKY */}
                <motion.div
                  animate={ballControls}
                  className="absolute inset-2.5 rounded-full pointer-events-none z-20 flex justify-center items-start"
                >
                  {/* Reálná 3D kulička s odleskem */}
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-radial from-white via-slate-200 to-slate-400 shadow-[0_2px_8px_rgba(0,0,0,0.8),inset_-1px_-1px_3px_rgba(0,0,0,0.4),0_0_6px_rgba(255,255,255,0.8)] border border-white/80 mt-1" />
                </motion.div>

                {/* LUXUSNÍ MOSAZNÝ STŘED (BRASS HUB) */}
                <div className="absolute inset-[26%] rounded-full border-2 border-amber-400/60 bg-gradient-to-b from-amber-600 via-yellow-700 to-amber-950 shadow-[0_0_25px_rgba(0,0,0,0.9),inset_0_2px_6px_rgba(255,255,255,0.4)] z-30 flex items-center justify-center">
                  {/* Vnitřní displej s výsledkem */}
                  <div className="h-[82%] w-[82%] rounded-full bg-neutral-950 border border-amber-500/40 flex flex-col items-center justify-center shadow-[inset_0_4px_12px_rgba(0,0,0,0.95)] p-1">
                    <p className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.25em] text-amber-400/70 font-semibold">
                      Poslední
                    </p>
                    <FxText
                      glitch
                      className={cn(
                        "font-display text-3xl sm:text-4xl font-extrabold tracking-tight",
                        lastRound
                          ? colorOf(lastRound.result) === "red"
                            ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                            : colorOf(lastRound.result) === "green"
                              ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                              : "text-slate-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                          : "text-neutral-600",
                      )}
                    >
                      {lastRound ? lastRound.result : "—"}
                    </FxText>
                  </div>
                </div>
              </div>
            </div>

            {/* Historie čísel pod ruletou */}
            <div className="mt-5 flex flex-wrap justify-center gap-1.5 z-10">
              {history.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 font-mono text-[10px] font-bold shadow-md transition-all duration-300",
                    colorOf(n) === "red"
                      ? "bg-red-950/80 text-red-400 border border-red-500/40"
                      : colorOf(n) === "green"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
                        : "bg-neutral-900 text-neutral-200 border border-neutral-700",
                  )}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </TiltCard>

        {/* Sázkový stůl */}
        <div className="glass fx-spotlight space-y-3 p-4 border-amber-500/20 bg-neutral-950/60">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-400/80 font-bold">Sázkový stůl</p>

          <div className="flex flex-wrap gap-2">
            {chip("red", undefined, "Červená 2×", "border-red-500/50 text-red-400 hover:bg-red-500/10")}
            {chip("black", undefined, "Černá 2×", "border-neutral-700 text-neutral-300 hover:bg-white/5")}
            {chip(
              "green",
              undefined,
              "Zelená 0 · 36×",
              "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10",
            )}
            {chip("even", undefined, "Sudá 2×")}
            {chip("odd", undefined, "Lichá 2×")}
            {chip("low", undefined, "1–18")}
            {chip("high", undefined, "19–36")}
            {chip("dozen", "1", "1. tucet 3×")}
            {chip("dozen", "2", "2. tucet 3×")}
            {chip("dozen", "3", "3. tucet 3×")}
          </div>

          {/* Grid čísel 0 až 36 */}
          <div className="grid grid-cols-9 gap-1 sm:grid-cols-12">
            {Array.from({ length: 37 }, (_, n) => {
              const active = selected.type === "number" && selected.value === String(n);
              return (
                <button
                  key={n}
                  onClick={() => setSelected({ type: "number", value: String(n) })}
                  className={cn(
                    "rounded-md py-1.5 font-mono text-[10px] font-bold transition hover:scale-110 shadow-sm",
                    colorOf(n) === "red"
                      ? "bg-red-600/20 text-red-400 border border-red-500/30"
                      : colorOf(n) === "green"
                        ? "bg-emerald-600/25 text-emerald-400 border border-emerald-500/40"
                        : "bg-neutral-800/60 text-neutral-300 border border-neutral-700",
                    active && "ring-2 ring-amber-400 bg-amber-400/20 border-amber-400 text-amber-200",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* Ovládací prváky sázek */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {[10, 100, 500].map((q) => (
              <button
                key={q}
                onClick={() => setStake((s) => s + q)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-300 hover:bg-amber-500/20 transition"
              >
                +${q}
              </button>
            ))}
            <button
              onClick={() => setStake(Math.max(1, Math.floor(balance)))}
              className="rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-2 font-mono text-[11px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/25 transition"
            >
              Max / all-in
            </button>
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-neutral-700 bg-black/60 px-2 py-2 font-mono text-sm text-white focus:border-amber-400 outline-none"
            />
            <button
              onClick={place}
              disabled={!user || spinning}
              className="rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-40 transition shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            >
              Vsadit ${stake}
            </button>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              zůstatek <CountUp value={balance} prefix="$" className="text-amber-400 font-bold" />
            </span>
          </div>
        </div>

        {/* Žetony a přehled výherců */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass p-4 border-neutral-800 bg-neutral-950/60">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold">Žetony v kole</p>
            <ul className="mt-2 space-y-1 text-xs">
              {bets.length === 0 && <li className="text-muted-foreground">Kolo je zatím bez sázek.</li>}
              {bets.map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span className="fx-text text-emerald-400">{b.nickname}</span>
                  <span className="font-mono text-neutral-300">
                    {b.bet_type}
                    {b.bet_value ? ` ${b.bet_value}` : ""} · ${Number(b.amount).toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
            {myBets.length > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                tvé sázky: ${myBets.reduce((s, b) => s + Number(b.amount), 0).toFixed(0)}
              </p>
            )}
          </div>
          <div className="glass p-4 border-neutral-800 bg-neutral-950/60">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-amber-400 font-bold">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Výherci kola #{lastRound?.round ?? "—"}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {!lastRound?.winners.length && <li className="text-muted-foreground">Zatím bez výherců.</li>}
              {lastRound?.winners.map((w) => (
                <li key={w.id} className="flex items-center justify-between">
                  <span className="fx-text fx-glitch text-amber-300">{w.nickname}</span>
                  <span className="font-mono text-emerald-400 font-bold">+${Number(w.payout).toFixed(0)}</span>
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
