import { useMemo, useState } from "react";
import { Beer, Flame, Gamepad2, Gem, Goal, Pickaxe, Shield, Sparkles, Trophy, Zap } from "lucide-react";
import { SlotMachine } from "@/components/slots/SlotMachine";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const GAMES = [
  {
    id: "neon-pints",
    title: "Neon Pints",
    kicker: "NIGHT MATCH",
    description: "Neonový sportbar, rychlé spiny a chmelové trofeje.",
    icon: Beer,
    accent: "from-emerald-400/30 via-cyan-400/10 to-transparent",
    badge: "VOLATILITY · HIGH",
  },
  {
    id: "hop-highway",
    title: "Hop Highway",
    kicker: "RACE MODE",
    description: "Futuristická trať, boosty a jackpotové přímé zásahy.",
    icon: Goal,
    accent: "from-yellow-400/30 via-orange-400/10 to-transparent",
    badge: "VOLATILITY · MID",
  },
  {
    id: "golden-chmel",
    title: "Golden Chmel",
    kicker: "GOLD SERIES",
    description: "Zlaté poháry, sportovní legendy a agresivní bonusy.",
    icon: Gem,
    accent: "from-amber-300/35 via-yellow-500/10 to-transparent",
    badge: "VOLATILITY · HIGH",
  },
  {
    id: "cursed-kegs",
    title: "Cursed Kegs",
    kicker: "DARK MODE",
    description: "Prokleté sudy, WILD řetězení a temný stadion.",
    icon: Shield,
    accent: "from-purple-500/30 via-fuchsia-500/10 to-transparent",
    badge: "VOLATILITY · EXTREME",
  },
  {
    id: "stadium-legends",
    title: "Stadium Legends",
    kicker: "HALL OF FAME",
    description: "Síň slávy sportovců s legendárními násobiteli.",
    icon: Trophy,
    accent: "from-sky-400/30 via-blue-500/10 to-transparent",
    badge: "VOLATILITY · MID",
  },
] as const;

type GameId = (typeof GAMES)[number]["id"];

/** Original SportChmeláci slot library. All games use the existing authoritative play-money slot engine. */
export function SlotGameLibrary({ onExchange }: { onExchange?: () => void }) {
  const { nickname } = useAuth();
  const [selected, setSelected] = useState<GameId | null>(null);
  const game = useMemo(() => GAMES.find((item) => item.id === selected) ?? null, [selected]);

  return (
    <section className="mt-8 rounded-3xl border border-hop-gold/25 bg-black/35 p-4 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-hop-neon/80">
            <Gamepad2 className="h-4 w-4" /> Chmelovci Slot Library
          </div>
          <h2 className="mt-1 font-display text-2xl tracking-[0.12em] slot-gold-text sm:text-3xl">NOVÉ HRY</h2>
          <p className="mt-1 max-w-2xl text-xs text-foreground/60 sm:text-sm">
            Originální herní skiny SportChmeláci. Všechny používají stejný serverově autoritativní engine a měnu Slot CZK pouze pro zábavu.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-hop-gold/25 bg-hop-gold/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-hop-gold/80">
          <Zap className="h-3.5 w-3.5" /> PLAY MONEY
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {GAMES.map((item) => {
          const Icon = item.icon;
          const active = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-3 text-left transition duration-300",
                active
                  ? "border-hop-gold/80 bg-hop-gold/10 shadow-[0_0_35px_-14px_rgba(255,204,68,.95)]"
                  : "border-hop-gold/20 bg-black/30 hover:border-hop-gold/50 hover:bg-black/50",
              )}
            >
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 transition group-hover:opacity-100", item.accent)} />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[0.16em] text-white/50">
                    {item.kicker}
                  </span>
                  <Icon className="h-5 w-5 text-hop-gold" />
                </div>
                <h3 className="mt-4 font-display text-lg tracking-[0.08em] text-white">{item.title}</h3>
                <p className="mt-1 min-h-10 text-[10px] leading-relaxed text-foreground/60">{item.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-hop-neon/70">{item.badge}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.14em]", active ? "bg-hop-gold text-black" : "border border-hop-gold/30 text-hop-gold")}>
                    <Sparkles className="h-3 w-3" /> Hrát
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {game && (
        <div className="mt-6 rounded-3xl border border-hop-gold/30 bg-black/45 p-2 sm:p-4">
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-hop-gold/20 bg-hop-gold/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-hop-gold/35 bg-hop-gold/10 text-hop-gold">
                <game.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-hop-neon/70">{game.kicker}</p>
                <h3 className="font-display text-xl tracking-[0.1em] text-white">{game.title}</h3>
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="self-start rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/45 hover:text-white/80 sm:self-auto">
              Zavřít
            </button>
          </div>

          <div className="[&>div>div.mb-3:nth-child(2)]:hidden">
            <SlotMachine playerName={nickname ?? "Hráč"} onExchange={onExchange} />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 text-[9px] font-mono uppercase tracking-[0.16em] text-white/35 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2"><Flame className="mb-1 h-3.5 w-3.5 text-hop-gold/70" /> Nové tematické skiny</div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2"><Pickaxe className="mb-1 h-3.5 w-3.5 text-hop-neon/70" /> Stejná bezpečná wallet vrstva</div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2"><Sparkles className="mb-1 h-3.5 w-3.5 text-sky-300/70" /> Vlastní budoucí matematika po jednom</div>
      </div>
    </section>
  );
}
