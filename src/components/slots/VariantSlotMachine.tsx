import { useMemo, useState } from "react";
import { Loader2, Sparkles, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/lib/wallet";
import type { SlotVariantId } from "@/components/slots/SlotVariantFrame";
import { cn } from "@/lib/utils";

const META: Record<SlotVariantId, { columns: number; rows: number; symbols: Record<string, string>; accent: string }> = {
  "neon-pints": { columns: 6, rows: 5, accent: "cyan", symbols: { pint: "🍺", bolt: "⚡", neon: "✦", ball: "⚽", star: "★", k: "K", q: "Q", j: "J", ten: "10" } },
  "hop-highway": { columns: 5, rows: 3, accent: "orange", symbols: { helmet: "🪖", car: "🏎️", flag: "🏁", boost: "⚡", ball: "⚽", k: "K", q: "Q", j: "J", ten: "10" } },
  "golden-chmel": { columns: 5, rows: 3, accent: "gold", symbols: { trophy_gold: "🏆", trophy_silver: "🥈", diamond: "◆", ball: "⚽", whistle: "📣", k: "K", q: "Q", j: "J", ten: "10" } },
  "cursed-kegs": { columns: 6, rows: 4, accent: "purple", symbols: { cursed_keg: "🛢️", wild: "☠", skull: "💀", chain: "⛓", ball: "⚽", k: "K", q: "Q", j: "J", ten: "10" } },
  "stadium-legends": { columns: 5, rows: 4, accent: "blue", symbols: { legend: "👑", trophy_gold: "🏆", wild: "★", ball: "⚽", boot: "👟", k: "K", q: "Q", j: "J", ten: "10" } },
};

type SpinResult = { game_id: SlotVariantId; grid: string[][]; columns: number; rows: number; total: number; multiplier_of_bet: number; feature: string; slot_czk: number };

export function VariantSlotMachine({ game, playerName }: { game: SlotVariantId; playerName: string }) {
  const meta = META[game];
  const { slotCZK, ready } = useWallet();
  const [shownBalance, setShownBalance] = useState(slotCZK);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState("Připraveno");

  const symbols = useMemo(() => Object.entries(meta.symbols), [meta.symbols]);
  const grid = result?.grid ?? Array.from({ length: meta.columns }, (_, c) => Array.from({ length: meta.rows }, (_, r) => symbols[(c + r) % symbols.length][0]));

  async function spin() {
    if (!ready || spinning) return;
    const balance = Math.max(shownBalance, slotCZK);
    if (bet > balance) { setMessage("Nedostatek Slot CZK — použij Směnárnu."); return; }
    setSpinning(true); setMessage("TOČÍME…"); setResult(null);
    const { data, error } = await supabase.rpc("slot_variant_spin", { _game_id: game, _bet: bet });
    if (error) {
      setMessage(error.message || "Hru se nepodařilo spustit.");
      setSpinning(false);
      return;
    }
    const parsed = Array.isArray(data) ? data[0] : data;
    const next = parsed as SpinResult | null;
    if (!next?.grid || !Number.isFinite(Number(next.slot_czk))) {
      setMessage("Server nevrátil platný výsledek hry.");
      setSpinning(false);
      return;
    }
    window.setTimeout(() => {
      setResult(next);
      setShownBalance(Number(next.slot_czk));
      setMessage(next.total > 0 ? `${next.feature} · VÝHRA ${next.total.toLocaleString("cs-CZ")} CZK` : next.feature);
      setSpinning(false);
      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 450);
  }

  const accent = meta.accent === "cyan" ? "border-cyan-300/40 shadow-[0_0_45px_-22px_rgba(34,211,238,.95)]" : meta.accent === "orange" ? "border-orange-300/40 shadow-[0_0_45px_-22px_rgba(251,146,60,.95)]" : meta.accent === "gold" ? "border-yellow-300/45 shadow-[0_0_45px_-20px_rgba(250,204,21,1)]" : meta.accent === "purple" ? "border-fuchsia-300/40 shadow-[0_0_45px_-22px_rgba(217,70,239,.95)]" : "border-sky-300/40 shadow-[0_0_45px_-22px_rgba(56,189,248,.95)]";

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/45 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2">
        <div><p className="font-mono text-[8px] uppercase tracking-[.22em] text-white/40">Hráč</p><p className="font-display text-sm text-white">{playerName}</p></div>
        <div className="text-right"><p className="font-mono text-[8px] uppercase tracking-[.22em] text-white/40">Slot CZK</p><p className="font-mono text-sm font-black text-hop-gold">{shownBalance.toLocaleString("cs-CZ")} Kč</p></div>
      </div>

      <div className={cn("mx-auto grid max-w-4xl gap-1.5 rounded-2xl border bg-black/55 p-2 transition", accent)} style={{ gridTemplateColumns: `repeat(${meta.columns}, minmax(0, 1fr))` }}>
        {grid.flatMap((col, c) => col.map((symbol, r) => {
          const active = !spinning && result?.grid?.[c]?.[r] === symbol;
          return <div key={`${c}-${r}`} className={cn("flex aspect-square items-center justify-center rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.07] to-black/60 font-display text-lg text-white sm:text-2xl", spinning ? "animate-pulse opacity-70" : "", active && result?.total ? "ring-1 ring-hop-gold/60" : "")}>
            <span className={symbol === "wild" ? "text-hop-gold drop-shadow-[0_0_14px_rgba(255,204,68,.9)]" : ""}>{meta.symbols[symbol] ?? symbol}</span>
          </div>;
        }))}
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-white/45"><Sparkles className="h-3.5 w-3.5 text-hop-neon" /> {message}</div><p className="mt-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/25">Serverové RNG · Play Money · Slot CZK</p></div>
        <div className="flex items-center gap-2">
          <select value={bet} onChange={(e) => setBet(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-bold text-white outline-none"><option value={5}>5 Kč</option><option value={10}>10 Kč</option><option value={25}>25 Kč</option><option value={50}>50 Kč</option><option value={100}>100 Kč</option></select>
          <button type="button" onClick={() => void spin()} disabled={!ready || spinning} className="inline-flex items-center gap-2 rounded-xl bg-hop-gold px-4 py-2.5 text-xs font-black uppercase tracking-[.14em] text-black disabled:cursor-not-allowed disabled:opacity-50">
            {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {spinning ? "Točíme" : "SPIN"}
          </button>
        </div>
      </div>

      {result && <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/30 p-3"><Trophy className="h-4 w-4 text-hop-gold" /><p className="mt-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/35">Výhra</p><p className="font-display text-lg text-white">{result.total.toLocaleString("cs-CZ")} CZK</p></div><div className="rounded-xl border border-white/10 bg-black/30 p-3"><Sparkles className="h-4 w-4 text-hop-neon" /><p className="mt-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/35">Feature</p><p className="font-display text-sm text-white">{result.feature}</p></div><div className="rounded-xl border border-white/10 bg-black/30 p-3"><CircleDollarSignIcon /><p className="mt-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/35">Násobitel</p><p className="font-display text-lg text-white">{Number(result.multiplier_of_bet || 0).toFixed(2)}×</p></div></div>}
    </div>
  );
}

function CircleDollarSignIcon() { return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-hop-gold/60 font-mono text-[9px] text-hop-gold">$</span>; }
