import { useEffect, useMemo, useState } from "react";
import { Sparkles, Timer, Coins, Ticket } from "lucide-react";
import { UltimateCard } from "@/components/ut/UltimateCard";
import {
  dailyReadyIn,
  fetchSpinTypes,
  formatCountdown,
  rarityMeta,
  spin,
  utErrorMessage,
} from "@/lib/ut";
import type { UtClub, UtSpinResult, UtSpinType } from "@/types/ut";
import { cn } from "@/lib/utils";

interface Props {
  club: UtClub;
  onClubChange: (patch: Partial<UtClub>) => void;
  onCardWon: () => void;
}

/** Card Spin — server-authoritative losování karet s reveal animací. */
export function CardSpinPanel({ club, onClubChange, onCardWon }: Props) {
  const [types, setTypes] = useState<UtSpinType[]>([]);
  const [active, setActive] = useState<string>("daily");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "spinning" | "reveal">("idle");
  const [result, setResult] = useState<UtSpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetchSpinTypes()
      .then((t) => {
        setTypes(t);
        if (t.length && !t.some((x) => x.key === active)) setActive(t[0].key);
      })
      .catch((e) => setError(utErrorMessage(e)));
  }, [active]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const current = useMemo(() => types.find((t) => t.key === active), [types, active]);
  const cooldownMs = current ? dailyReadyIn(club.lastDailySpinAt, current.cooldownHours) : 0;
  const locked = cooldownMs > 0;
  void now;

  const affordable =
    !!current &&
    club.coins >= current.costCoins &&
    club.spinTokens >= current.costTokens &&
    club.eventTokens >= current.costEventTokens;

  async function doSpin() {
    if (!current || busy || locked || !affordable) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setPhase("spinning");
    try {
      const res = await spin(current.key);
      window.setTimeout(() => {
        setResult(res);
        setPhase("reveal");
        onClubChange({
          coins: res.coins,
          spinTokens: res.spinTokens,
          luckMeter: res.luckMeter,
          lastDailySpinAt: res.lastDailySpinAt,
        });
        onCardWon();
        setBusy(false);
      }, 1400);
    } catch (e) {
      setError(utErrorMessage(e));
      setPhase("idle");
      setBusy(false);
    }
  }

  const luckPct = current ? Math.min(100, Math.round((club.luckMeter / current.pityThreshold) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em]",
              active === t.key
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 bg-background/50 text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current && (
        <div className="rounded-2xl border border-primary/25 bg-background/50 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 font-mono text-amber-200">
              <Coins className="h-3.5 w-3.5" /> {current.costCoins ? `${current.costCoins} coinů` : "zdarma"}
            </span>
            {current.costTokens > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-cyan-200">
                <Ticket className="h-3.5 w-3.5" /> {current.costTokens} token
              </span>
            )}
            {current.cooldownHours && (
              <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                {locked ? formatCountdown(cooldownMs) : "připraveno"}
              </span>
            )}
          </div>

          <div className="mt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
              Luck meter {club.luckMeter}/{current.pityThreshold}
            </p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-primary/25 bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400 transition-all duration-500"
                style={{ width: `${luckPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Při plném meteru máš garantovanou vzácnou kartu (Special a lepší).
            </p>
          </div>

          <button
            onClick={doSpin}
            disabled={busy || locked || !affordable}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/15 px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-primary disabled:opacity-40"
          >
            <Sparkles className={cn("h-4 w-4", busy && "animate-spin")} />
            {locked ? "Cooldown" : busy ? "Losuji…" : "Roztočit Card Spin"}
          </button>
          {!affordable && !locked && (
            <p className="mt-2 text-xs text-danger">Nemáš dost prostředků na tento spin.</p>
          )}
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}

      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.18),transparent_70%)] p-6">
        {phase === "spinning" && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-40 w-28 animate-pulse rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-primary/25 to-black" />
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Losování…</p>
          </div>
        )}
        {phase === "reveal" && result && (
          <div className="flex flex-col items-center gap-3">
            <div className={cn("animate-in fade-in zoom-in duration-500", rarityMeta(result.rarity).walkout && "drop-shadow-[0_0_40px_rgba(255,255,255,0.35)]")}>
              <UltimateCard card={result.card} size="lg" />
            </div>
            <p className="font-display text-lg uppercase tracking-[0.18em] text-primary">
              {rarityMeta(result.rarity).label}
              {result.pity ? " · Pity!" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.duplicate ? "Duplikát — můžeš ji rychle prodat." : "Nová karta v tvé sbírce!"}
            </p>
          </div>
        )}
        {phase === "idle" && (
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Roztoč Card Spin a získej hráče do svého klubu. Šance jsou počítány na serveru — bez podvádění.
          </p>
        )}
      </div>
    </div>
  );
}

export default CardSpinPanel;
