import { useMemo, useState } from "react";
import { Beer, CarFront, ChevronRight, Fish, Flame, Gamepad2, Gem, Hammer, Pickaxe, Shield, Sparkles, Trophy, Zap } from "lucide-react";
import { EpicSlotMachineCinematic } from "@/components/slots/EpicSlotMachineCinematic";
import { VariantSlotMachine } from "@/components/slots/VariantSlotMachine";
import { SlotVariantFrame, type SlotVariantId } from "@/components/slots/SlotVariantFrame";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type EpicGameId = "thunder-egg" | "bass-bounty";
type CatalogGameId = SlotVariantId | EpicGameId;

type CatalogGame = {
  id: CatalogGameId;
  title: string;
  kicker: string;
  description: string;
  icon: typeof Beer;
  accent: string;
  frame: string;
  badge: string;
  feature: string;
  motif: string;
  stat: string;
  epic?: boolean;
};

const GAMES: CatalogGame[] = [
  { id:"thunder-egg", title:"Thunder Egg", kicker:"OLYMPUS STORM", description:"6×5 cluster slot s cascades, Divine Reveal, Lightning zásahy a třemi bonusovými režimy.", icon:Hammer, accent:"from-amber-400/50 via-indigo-500/20 to-transparent", frame:"border-amber-300/45 hover:border-yellow-100/90", badge:"EPIC VOL", feature:"DIVINE REVEAL", motif:"STORM", stat:"6 × 5", epic:true },
  { id:"bass-bounty", title:"Bass Bounty", kicker:"WILD WATER", description:"5×3 money-symbol bonanza s collector wildem, free spiny a retrigger multipliery.", icon:Fish, accent:"from-cyan-400/50 via-blue-500/20 to-transparent", frame:"border-cyan-300/45 hover:border-cyan-100/90", badge:"EPIC VOL", feature:"MEGA CATCH", motif:"WILD WATER", stat:"5 × 3", epic:true },
  { id:"neon-pints", title:"Neon Pints", kicker:"NEON CASCADE", description:"Cyber sportbar, světelné trubice a padající symboly.", icon:Beer, accent:"from-cyan-400/45 via-emerald-400/12 to-transparent", frame:"border-cyan-300/30 hover:border-cyan-200/75", badge:"HIGH VOL", feature:"CASCADE / CLUSTER", motif:"NEON", stat:"6 × 5" },
  { id:"hop-highway", title:"Hop Highway", kicker:"BOOST CIRCUIT", description:"Noční závodní trať, rychlost, boosty a respiny.", icon:CarFront, accent:"from-orange-400/45 via-amber-300/12 to-transparent", frame:"border-orange-300/30 hover:border-orange-200/75", badge:"MID VOL", feature:"BOOST / RESPIN", motif:"RACE", stat:"5 × 3" },
  { id:"golden-chmel", title:"Golden Chmel", kicker:"GOLD SERIES", description:"Championship stadion, poháry a premium násobitele.", icon:Trophy, accent:"from-yellow-300/50 via-amber-400/15 to-transparent", frame:"border-yellow-300/35 hover:border-yellow-100/80", badge:"HIGH VOL", feature:"MULTIPLIER", motif:"GOLD", stat:"5 × 3" },
  { id:"cursed-kegs", title:"Cursed Kegs", kicker:"DARK CELLAR", description:"Temná aréna, mystery sudy a řetězení wild symbolů.", icon:Shield, accent:"from-fuchsia-500/45 via-purple-500/14 to-transparent", frame:"border-fuchsia-300/30 hover:border-purple-200/75", badge:"EXTREME", feature:"MYSTERY / WILD", motif:"DARK", stat:"6 × 4" },
  { id:"stadium-legends", title:"Stadium Legends", kicker:"HALL OF FAME", description:"Prémiová sportovní síň slávy s legendárními wildy.", icon:Gem, accent:"from-sky-400/45 via-blue-500/15 to-transparent", frame:"border-sky-300/30 hover:border-blue-200/75", badge:"MID VOL", feature:"LEGEND WILDS", motif:"LEGENDS", stat:"5 × 4" },
];

export function SlotGameLibrary({ onExchange }: { onExchange?: () => void }) {
  const { nickname } = useAuth();
  const [selected, setSelected] = useState<CatalogGameId | null>(null);
  const game = useMemo(() => GAMES.find((item) => item.id === selected) ?? null, [selected]);

  return (
    <section className="mt-5 overflow-hidden rounded-[30px] border border-white/10 bg-[#070b10]/95 p-3 shadow-[0_28px_90px_-60px_rgba(0,0,0,.95)] sm:p-5">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.3em] text-[#4dffa6]/80"><Gamepad2 className="h-4 w-4" /> SLOT GAME CATALOG</div>
          <h2 className="mt-1 font-display text-3xl tracking-[.13em] text-white sm:text-4xl">VYBER SI HRU</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/48 sm:text-sm">Epic edice mají vlastní bonusový flow, originální vektorové symboly a cinematické VFX; ostatní tituly mají vlastní vizuální identitu a serverovou výherní logiku.</p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#4dffa6]/20 bg-[#4dffa6]/5 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.18em] text-[#4dffa6]"><Zap className="h-3.5 w-3.5" /> SERVER RNG · SLOT CZK</div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {GAMES.map((item) => {
          const Icon = item.icon;
          const active = selected === item.id;
          return <button key={item.id} type="button" onClick={() => setSelected(active ? null : item.id)} aria-pressed={active} className={cn("group relative min-h-[300px] overflow-hidden rounded-[22px] border text-left transition duration-300 hover:-translate-y-1", item.frame, active ? "ring-2 ring-white/15 shadow-[0_24px_70px_-28px_rgba(255,255,255,.28)]" : "")}>
            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", item.accent)} />
            {item.epic && <div className="pointer-events-none absolute right-2 top-2 rounded-full border border-hop-gold/60 bg-hop-gold/15 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.16em] text-hop-gold">EPIC</div>}
            <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="pointer-events-none absolute -right-10 top-16 h-44 w-44 rounded-full bg-white/5 blur-3xl transition duration-500 group-hover:bg-white/10" />
            <div className="relative flex h-full flex-col p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2"><span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/55">{item.kicker}</span><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/30 text-white/85"><Icon className="h-5 w-5" /></div></div>
              <div className="relative mt-4 flex min-h-[130px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-black/30"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.09),transparent_60%)]"/><div className="relative text-center"><div className="font-display text-[10px] font-black tracking-[.5em] text-white/20">{item.motif}</div><Icon className="mx-auto mt-2 h-16 w-16 text-white/85 drop-shadow-[0_0_25px_rgba(255,255,255,.2)] transition duration-500 group-hover:scale-110" strokeWidth={1.15}/><div className="mt-2 font-mono text-[8px] font-black uppercase tracking-[.3em] text-white/35">{item.stat} · PLAY MONEY</div></div></div>
              <div className="mt-4"><h3 className="font-display text-2xl tracking-[.08em] text-white">{item.title}</h3><p className="mt-1 min-h-[34px] text-[10px] leading-relaxed text-white/52">{item.description}</p></div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-3"><span className="rounded-md border border-white/8 bg-white/[.03] px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.14em] text-white/38">{item.feature}</span><span className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.13em]", active ? "bg-white text-black" : "border border-white/15 bg-black/25 text-white/80 group-hover:border-white/30")}>{active ? "OTEVŘENO" : "HRÁT"}<ChevronRight className="h-3 w-3" /></span></div>
            </div>
          </button>;
        })}
      </div>

      {game && <div className="mt-5">{game.epic ? <EpicSlotMachineCinematic game={game.id as EpicGameId} playerName={nickname ?? "Hráč"} /> : <SlotVariantFrame game={game.id as SlotVariantId}><VariantSlotMachine game={game.id as SlotVariantId} playerName={nickname ?? "Hráč"} /></SlotVariantFrame>}</div>}

      <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><Hammer className="h-4 w-4 text-[#ffcc44]/65"/><div className="mt-2 font-mono text-[8px] font-black uppercase tracking-[.16em] text-white/42">Originální vector artwork</div></div><div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><Pickaxe className="h-4 w-4 text-[#4dffa6]/65"/><div className="mt-2 font-mono text-[8px] font-black uppercase tracking-[.16em] text-white/42">Server rozhoduje o výsledku</div></div><div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><Sparkles className="h-4 w-4 text-sky-300/65"/><div className="mt-2 font-mono text-[8px] font-black uppercase tracking-[.16em] text-white/42">Slot CZK · pouze play money</div></div></div>
    </section>
  );
}
