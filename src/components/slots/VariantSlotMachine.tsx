import { useMemo, useState } from "react";
import { Beer, CarFront, CircleDollarSign, Crown, FlagTriangleRight, Gem, Goal, Link2, Loader2, Medal, Megaphone, ShieldAlert, Skull, Sparkles, Star, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import type { SlotVariantId } from "@/components/slots/SlotVariantFrame";
import { cn } from "@/lib/utils";

const META: Record<SlotVariantId, { columns: number; rows: number; symbols: string[]; accent: "cyan" | "orange" | "gold" | "purple" | "blue"; label: string }> = {
  "neon-pints": { columns: 6, rows: 5, accent: "cyan", label: "NEON CASCADE", symbols: ["pint", "bolt", "neon", "ball", "star", "k", "q", "j", "ten", "wild"] },
  "hop-highway": { columns: 5, rows: 3, accent: "orange", label: "BOOST CIRCUIT", symbols: ["helmet", "car", "flag", "boost", "ball", "k", "q", "j", "ten", "wild"] },
  "golden-chmel": { columns: 5, rows: 3, accent: "gold", label: "GOLD SERIES", symbols: ["trophy_gold", "trophy_silver", "diamond", "ball", "whistle", "k", "q", "j", "ten", "wild"] },
  "cursed-kegs": { columns: 6, rows: 4, accent: "purple", label: "DARK CELLAR", symbols: ["cursed_keg", "mystery", "wild", "skull", "chain", "ball", "k", "q", "j", "ten"] },
  "stadium-legends": { columns: 5, rows: 4, accent: "blue", label: "HALL OF FAME", symbols: ["legend", "trophy_gold", "wild", "ball", "boot", "champion", "k", "q", "j", "ten"] },
};

type SpinResult = { game_id: SlotVariantId; grid: string[][]; columns: number; rows: number; total: number; multiplier_of_bet: number; feature: string; slot_czk: number };

function accentTokens(accent: string) {
  if (accent === "cyan") return { shell: "border-cyan-300/30 shadow-[0_35px_100px_-55px_rgba(34,211,238,.85)]", edge: "via-cyan-300/70", glow: "shadow-[0_0_30px_-12px_rgba(34,211,238,.8)]", text: "text-cyan-200" };
  if (accent === "orange") return { shell: "border-orange-300/30 shadow-[0_35px_100px_-55px_rgba(251,146,60,.85)]", edge: "via-orange-300/70", glow: "shadow-[0_0_30px_-12px_rgba(251,146,60,.8)]", text: "text-orange-200" };
  if (accent === "gold") return { shell: "border-yellow-300/35 shadow-[0_35px_100px_-55px_rgba(250,204,21,.9)]", edge: "via-yellow-200/75", glow: "shadow-[0_0_30px_-12px_rgba(250,204,21,.85)]", text: "text-yellow-100" };
  if (accent === "purple") return { shell: "border-fuchsia-300/30 shadow-[0_35px_100px_-55px_rgba(217,70,239,.85)]", edge: "via-fuchsia-300/70", glow: "shadow-[0_0_30px_-12px_rgba(217,70,239,.8)]", text: "text-fuchsia-100" };
  return { shell: "border-sky-300/30 shadow-[0_35px_100px_-55px_rgba(56,189,248,.85)]", edge: "via-sky-300/70", glow: "shadow-[0_0_30px_-12px_rgba(56,189,248,.8)]", text: "text-sky-100" };
}

function SymbolArt({ symbol }: { symbol: string }) {
  const common = "h-9 w-9 sm:h-11 sm:w-11";
  const small = "font-display text-lg sm:text-xl font-black tracking-[.08em] text-white/90";
  switch (symbol) {
    case "pint": return <Beer className={`${common} text-cyan-200`} strokeWidth={1.4} />;
    case "bolt": return <Zap className={`${common} text-lime-200`} strokeWidth={1.45} />;
    case "neon": return <Sparkles className={`${common} text-fuchsia-200`} strokeWidth={1.35} />;
    case "ball": return <Goal className={`${common} text-white/85`} strokeWidth={1.35} />;
    case "star": return <Star className={`${common} text-cyan-100`} strokeWidth={1.35} />;
    case "helmet": return <ShieldAlert className={`${common} text-orange-200`} strokeWidth={1.35} />;
    case "car": return <CarFront className={`${common} text-orange-100`} strokeWidth={1.35} />;
    case "flag": return <FlagTriangleRight className={`${common} text-amber-100`} strokeWidth={1.35} />;
    case "boost": return <Zap className={`${common} text-yellow-100`} strokeWidth={1.5} />;
    case "trophy_gold": return <Trophy className={`${common} text-yellow-100`} strokeWidth={1.3} />;
    case "trophy_silver": return <Medal className={`${common} text-slate-200`} strokeWidth={1.3} />;
    case "diamond": return <Gem className={`${common} text-amber-100`} strokeWidth={1.25} />;
    case "whistle": return <Megaphone className={`${common} text-yellow-100`} strokeWidth={1.25} />;
    case "cursed_keg": return <ShieldAlert className={`${common} text-fuchsia-100`} strokeWidth={1.25} />;
    case "mystery": return <CircleDollarSign className={`${common} text-fuchsia-100`} strokeWidth={1.25} />;
    case "skull": return <Skull className={`${common} text-violet-100`} strokeWidth={1.25} />;
    case "chain": return <Link2 className={`${common} text-purple-100`} strokeWidth={1.3} />;
    case "legend": return <Crown className={`${common} text-sky-100`} strokeWidth={1.2} />;
    case "boot": return <ShieldAlert className={`${common} text-blue-100`} strokeWidth={1.2} />;
    case "champion": return <Medal className={`${common} text-sky-100`} strokeWidth={1.2} />;
    case "wild": return <div className="grid h-10 w-10 place-items-center rounded-xl border border-yellow-200/30 bg-yellow-200/10 text-[10px] font-black tracking-[.16em] text-yellow-100 shadow-[0_0_24px_rgba(255,204,68,.28)] sm:h-12 sm:w-12">WILD</div>;
    case "k": case "q": case "j": case "ten": return <span className={small}>{symbol.toUpperCase()}</span>;
    default: return <span className={small}>{symbol}</span>;
  }
}

export function VariantSlotMachine({ game, playerName }: { game: SlotVariantId; playerName: string }) {
  const meta = META[game];
  const { slotCZK, ready, spinVariantSlot } = useWallet();
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState("READY · PLACE YOUR SPIN");
  const [spinCount, setSpinCount] = useState(0);
  const theme = accentTokens(meta.accent);
  const symbols = useMemo(() => meta.symbols, [meta.symbols]);
  const grid = result?.grid ?? Array.from({ length: meta.columns }, (_, c) => Array.from({ length: meta.rows }, (_, r) => symbols[(c * 2 + r) % symbols.length]));

  async function spin() {
    if (!ready || spinning) return;
    if (bet > slotCZK) { setMessage("NEDOSTATEK SLOT CZK · OTEVŘI SMĚNÁRNU"); return; }
    setSpinning(true);
    setMessage("SERVER RNG · GENERATING RESULT…");
    setResult(null);
    const response = await spinVariantSlot(game, bet);
    if (!response.ok || !response.result) {
      setMessage(response.error ?? "Hru se nepodařilo spustit.");
      setSpinning(false);
      return;
    }
    const next = response.result as SpinResult;
    if (!next.grid || next.columns !== meta.columns || next.rows !== meta.rows || !Number.isFinite(Number(next.slot_czk))) {
      setMessage("SERVER RETURNED INVALID RESULT");
      setSpinning(false);
      return;
    }
    window.setTimeout(() => {
      setResult(next);
      setSpinCount((n) => n + 1);
      setMessage(next.total > 0 ? `${next.feature} · +${next.total.toLocaleString("cs-CZ")} CZK` : `${next.feature} · NO WIN`);
      setSpinning(false);
      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 500);
  }

  return (
    <div className={cn("relative overflow-hidden rounded-[26px] border bg-[#05080c] p-3 sm:p-5", theme.shell)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(255,255,255,.06),transparent_32%),linear-gradient(180deg,rgba(255,255,255,.035),transparent_24%,rgba(0,0,0,.18))]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.028)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="relative mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <div className={cn("font-mono text-[8px] font-black uppercase tracking-[.28em]", theme.text)}>{meta.label} · SPORTCHMELÁCI ORIGINAL</div>
          <div className="mt-1 flex items-end gap-3"><h3 className="font-display text-2xl tracking-[.1em] text-white sm:text-3xl">{game.replaceAll("-", " ").toUpperCase()}</h3><span className="mb-1 rounded-md border border-white/10 bg-white/[.03] px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.16em] text-white/35">{meta.columns}×{meta.rows}</span></div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-right"><div className="font-mono text-[7px] uppercase tracking-[.18em] text-white/30">PLAYER</div><div className="max-w-32 truncate font-mono text-[9px] font-black text-white/75">{playerName}</div></div>
          <div className="rounded-xl border border-[#ffcc44]/20 bg-[#ffcc44]/5 px-3 py-2 text-right"><div className="font-mono text-[7px] uppercase tracking-[.18em] text-[#ffcc44]/45">SLOT CZK</div><div className="font-mono text-[10px] font-black text-[#ffe69a]">{slotCZK.toLocaleString("cs-CZ")}</div></div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/50 p-2.5 sm:p-4">
        <div className={cn("pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent", theme.edge, "to-transparent")} />
        <div className="pointer-events-none absolute left-4 top-1/2 h-24 w-1 -translate-y-1/2 rounded-full bg-white/8" />
        <div className="pointer-events-none absolute right-4 top-1/2 h-24 w-1 -translate-y-1/2 rounded-full bg-white/8" />
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${meta.columns}, minmax(0, 1fr))` }}>
          {grid.flatMap((col, c) => col.map((symbol, r) => {
            const active = !spinning && result?.grid?.[c]?.[r] === symbol;
            return <div key={`${c}-${r}`} className={cn("relative flex aspect-square items-center justify-center overflow-hidden rounded-[14px] border bg-gradient-to-b from-white/[.075] via-white/[.025] to-black/80", spinning ? "animate-pulse border-white/5 opacity-65" : "border-white/10", active && result?.total ? cn("ring-2 ring-white/20", theme.glow) : "")}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.1),transparent_48%)]" />
              <div className="relative z-10 transition duration-300 hover:scale-105"><SymbolArt symbol={symbol} /></div>
            </div>;
          }))}
        </div>
      </div>

      <div className="relative mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center gap-2"><span className={cn("rounded-full border px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.17em]", theme.text, "border-white/10 bg-white/[.03]")}>{message}</span><span className="font-mono text-[7px] font-black uppercase tracking-[.16em] text-white/25">SPINS {spinCount}</span></div>
          <div className="mt-2 font-mono text-[8px] uppercase tracking-[.15em] text-white/25">SERVER RNG · PLAY MONEY · MAX 200× BET PAYOUT</div>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[.025] p-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <select value={bet} onChange={(e) => setBet(Number(e.target.value))} className="min-w-28 rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs font-black text-white outline-none">
            {[5,10,25,50,100,200,500].map((value) => <option key={value} value={value}>{value} Kč</option>)}
          </select>
          <button type="button" onClick={() => void spin()} disabled={!ready || spinning} className={cn("inline-flex min-w-32 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[.14em] text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50", meta.accent === "cyan" ? "bg-cyan-200" : meta.accent === "orange" ? "bg-orange-300" : meta.accent === "gold" ? "bg-yellow-200" : meta.accent === "purple" ? "bg-fuchsia-200" : "bg-sky-200")}>
            {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {spinning ? "TOČÍME" : "SPIN"}
          </button>
        </div>
      </div>

      {result && <div className="relative mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><Trophy className="h-4 w-4 text-[#ffcc44]" /><div className="mt-1 font-mono text-[7px] uppercase tracking-[.15em] text-white/30">VÝHRA</div><div className="font-display text-xl text-white">{result.total.toLocaleString("cs-CZ")} CZK</div></div>
        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><Sparkles className="h-4 w-4 text-[#4dffa6]" /><div className="mt-1 font-mono text-[7px] uppercase tracking-[.15em] text-white/30">FEATURE</div><div className="font-display text-sm text-white">{result.feature}</div></div>
        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><CircleDollarSign className="h-4 w-4 text-sky-200" /><div className="mt-1 font-mono text-[7px] uppercase tracking-[.15em] text-white/30">NÁSOBITEL</div><div className="font-display text-xl text-white">{Number(result.multiplier_of_bet || 0).toFixed(2)}×</div></div>
      </div>}
    </div>
  );
}
