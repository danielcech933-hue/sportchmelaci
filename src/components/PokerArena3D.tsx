import { useMemo } from "react";
import { motion } from "framer-motion";
import { Gem, Radio, Shield, Sparkles, Spade, Users } from "lucide-react";
import { LivePokerTournament } from "@/components/LivePokerTournament";
import { PokerLiveCinematicLayer } from "@/components/PokerLiveCinematicLayer";

export function PokerArena3D() {
  const ambient = useMemo(() => Array.from({ length: 22 }, (_, i) => i), []);

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-amber-400/20 bg-[#05070b] shadow-[0_40px_140px_-50px_rgba(255,196,67,.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,204,68,.16),transparent_26%),radial-gradient(circle_at_15%_72%,rgba(43,197,255,.10),transparent_24%),radial-gradient(circle_at_86%_68%,rgba(142,92,255,.11),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:28px_28px]" />
      {ambient.map((i) => <motion.span key={i} className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/40" style={{ left: `${4 + (i * 17) % 92}%`, top: `${8 + (i * 29) % 82}%` }} animate={{ opacity: [0, .45, 0], scale: [0, 1.8, 0] }} transition={{ duration: 3.2 + (i % 5) * .6, repeat: Infinity, delay: i * .16 }} />)}

      <header className="relative z-10 flex flex-col gap-4 border-b border-white/8 bg-black/35 px-5 py-5 backdrop-blur-xl sm:px-7 sm:py-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.35em] text-amber-300/80"><Spade className="h-4 w-4" /> CHMEL ARENA · 3D CARD ROOM</div>
          <h2 className="mt-2 font-display text-4xl tracking-[.14em] text-white sm:text-6xl">NEON POKER <span className="text-amber-300">// LIVE</span></h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/45 sm:text-sm">Prostorový multiplayer Texas Hold’em s živou prezentací rozdání, potu, showdownu a turn timeru. Karty, akce a vítěz zůstávají server-authoritative a pouze v play-money režimu.</p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[8px] font-black uppercase tracking-[.16em]">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-emerald-300"><Radio className="h-3 w-3" /> REALTIME</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-cyan-300"><Shield className="h-3 w-3" /> SERVER AUTH</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-amber-300"><Gem className="h-4 w-4" /> PLAY MONEY</span>
        </div>
      </header>

      <section className="relative z-10 p-3 sm:p-5"><PokerLiveCinematicLayer /></section>

      <div className="relative z-10 grid gap-3 px-3 pb-3 sm:grid-cols-3 sm:px-5 sm:pb-5">
        <ArenaFeature icon={<Sparkles />} title="CINEMATIC SHOWDOWN" text="Deal → bet → raise → river → showdown → payout má vlastní animovaný rytmus." />
        <ArenaFeature icon={<Users />} title="MULTIPLAYER" text="Lobby podporuje 2–9 hráčů, realtime synchronizaci, timer, chat a reconnect." />
        <ArenaFeature icon={<Shield />} title="SERVER AUTHORITATIVE" text="Shuffle, hand ranking, poty a finanční pohyby stále rozhoduje backend." />
      </div>

      <div className="relative z-10 border-t border-white/8 bg-black/25 p-3 sm:p-5"><LivePokerTournament /></div>
    </div>
  );
}

function ArenaFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="flex items-center gap-2 text-amber-300"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">{title}</span></div><p className="mt-2 text-[10px] leading-relaxed text-white/42">{text}</p></div>;
}
