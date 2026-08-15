import { useMemo, useState } from "react";
import { Beer, Flame, Gamepad2, Gem, Goal, Pickaxe, Shield, Sparkles, Trophy, Zap } from "lucide-react";
import { SlotMachine } from "@/components/slots/SlotMachine";
import { SlotVariantFrame, type SlotVariantId } from "@/components/slots/SlotVariantFrame";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const GAMES: Array<{ id: SlotVariantId; title: string; kicker: string; description: string; icon: typeof Beer; accent: string; frame: string; badge: string; feature: string }> = [
  { id: "neon-pints", title: "Neon Pints", kicker: "NEON CASCADE", description: "Cyber sportbar, neonové světlo a řetězení výher.", icon: Beer, accent: "from-cyan-400/35 via-emerald-400/15 to-transparent", frame: "border-cyan-300/35 hover:border-cyan-200/80", badge: "HIGH VOLATILITY", feature: "CASCADES" },
  { id: "hop-highway", title: "Hop Highway", kicker: "BOOST CIRCUIT", description: "Futuristický závodní okruh s boosty a respiny.", icon: Goal, accent: "from-amber-400/35 via-orange-400/15 to-transparent", frame: "border-amber-300/35 hover:border-orange-200/80", badge: "MID VOLATILITY", feature: "BOOST RESPINS" },
  { id: "golden-chmel", title: "Golden Chmel", kicker: "GOLD SERIES", description: "Prémiový stadion, trofeje a násobitelový bonus.", icon: Gem, accent: "from-yellow-300/40 via-yellow-500/15 to-transparent", frame: "border-yellow-300/40 hover:border-yellow-100/85", badge: "HIGH VOLATILITY", feature: "MULTIPLIER BONUS" },
  { id: "cursed-kegs", title: "Cursed Kegs", kicker: "DARK CELLAR", description: "Temný sklep, mystery sudy a wild řetězení.", icon: Shield, accent: "from-fuchsia-500/35 via-purple-500/15 to-transparent", frame: "border-fuchsia-300/35 hover:border-purple-200/80", badge: "EXTREME VOLATILITY", feature: "WILD CHAINS" },
  { id: "stadium-legends", title: "Stadium Legends", kicker: "HALL OF FAME", description: "Velká aréna, sticky wilds a free spiny.", icon: Trophy, accent: "from-sky-400/35 via-blue-500/15 to-transparent", frame: "border-sky-300/35 hover:border-blue-200/80", badge: "MID VOLATILITY", feature: "STICKY WILDS" },
];

type GameId = SlotVariantId;

export function SlotGameLibrary({ onExchange }: { onExchange?: () => void }) {
  const { nickname } = useAuth();
  const [selected, setSelected] = useState<GameId | null>(null);
  const game = useMemo(() => GAMES.find((item) => item.id === selected) ?? null, [selected]);

  return (
    <section className="mt-8 rounded-3xl border border-hop-gold/25 bg-black/35 p-4 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-hop-neon/80"><Gamepad2 className="h-4 w-4" /> Chmelovci Slot Library</div>
          <h2 className="mt-1 font-display text-2xl tracking-[0.12em] slot-gold-text sm:text-3xl">NOVÉ HRY</h2>
          <p className="mt-1 max-w-3xl text-xs text-foreground/60 sm:text-sm">Každý titul má vlastní sportovní identitu a vlastní designový směr. Všechny zatím používají bezpečnou play-money Slot CZK peněženku.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-hop-gold/25 bg-hop-gold/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-hop-gold/80"><Zap className="h-3.5 w-3.5" /> PLAY MONEY</div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {GAMES.map((item) => {
          const Icon = item.icon;
          const active = selected === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setSelected(active ? null : item.id)} className={cn("group relative min-h-[210px] overflow-hidden rounded-2xl border p-3 text-left transition duration-300 hover:-translate-y-0.5", item.frame, active ? "bg-hop-gold/10" : "bg-black/30 hover:bg-black/50")} aria-pressed={active}>
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 transition group-hover:opacity-100", item.accent)} />
              <div className="pointer-events-none absolute -right-8 top-8 h-28 w-28 rounded-full border border-white/10 bg-white/[0.03]" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between gap-2"><span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[0.16em] text-white/55">{item.kicker}</span><div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-hop-gold"><Icon className="h-5 w-5" /></div></div>
                <div className="mt-4 flex-1"><h3 className="font-display text-xl tracking-[0.08em] text-white">{item.title}</h3><p className="mt-1 min-h-10 text-[10px] leading-relaxed text-foreground/65">{item.description}</p></div>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-2"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[7px] uppercase tracking-[0.14em] text-hop-gold/85">{item.feature}</span><span className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/40">{item.badge}</span></div></div>
                <div className="mt-3 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.16em] text-white/35"><Flame className="h-3 w-3 text-hop-gold/70" /> PLAY MONEY</span><span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 font-mono text-[8px] font-black uppercase tracking-[0.14em]", active ? "bg-hop-gold text-black" : "border border-hop-gold/30 text-hop-gold")}><Sparkles className="h-3 w-3" /> {active ? "Otevřeno" : "Hrát"}</span></div>
              </div>
            </button>
          );
        })}
      </div>

      {game && <div className="mt-6"><SlotVariantFrame game={game.id}><div className="[&>div>div.mb-3:first-of-type]:hidden"><SlotMachine playerName={nickname ?? "Hráč"} onExchange={onExchange} /></div></SlotVariantFrame></div>}

      <div className="mt-4 grid gap-2 text-[9px] font-mono uppercase tracking-[0.16em] text-white/35 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2"><Flame className="mb-1 h-3.5 w-3.5 text-hop-gold/70" /> Každá hra má vlastní art direction</div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2"><Pickaxe className="mb-1 h-3.5 w-3.5 text-hop-neon/70" /> Stejná bezpečná wallet vrstva</div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2"><Sparkles className="mb-1 h-3.5 w-3.5 text-sky-300/70" /> Vlastní matematiku doplníme samostatně</div>
      </div>
    </section>
  );
}
