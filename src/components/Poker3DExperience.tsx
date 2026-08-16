import { motion } from "framer-motion";
import { Activity, CircleDollarSign, ShieldCheck, Volume2 } from "lucide-react";
import { Poker3DCinematicTable } from "@/components/Poker3DCinematicTable";
import { PokerCinematicFX } from "@/components/PokerCinematicFX";

export function Poker3DExperience() {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-amber-300/15 bg-black/50 shadow-[0_40px_140px_-55px_rgba(255,204,68,.55)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,204,68,.12),transparent_25%),radial-gradient(circle_at_12%_70%,rgba(30,180,255,.08),transparent_25%),radial-gradient(circle_at_88%_65%,rgba(160,80,255,.08),transparent_25%)]" />
      <div className="relative grid gap-3 border-b border-white/8 bg-black/30 p-3 sm:grid-cols-4 sm:p-4">
        <Status icon={<Activity />} title="TABLE STATUS" value="LIVE · 6/9 SEATS" tone="text-emerald-300" />
        <Status icon={<CircleDollarSign />} title="POT ENGINE" value="SERVER LOCKED" tone="text-amber-200" />
        <Status icon={<ShieldCheck />} title="FAIR PLAY" value="AUTHORITATIVE RNG" tone="text-cyan-300" />
        <Status icon={<Volume2 />} title="SFX / VFX" value="CINEMATIC" tone="text-fuchsia-300" />
      </div>
      <div className="relative p-2 sm:p-4">
        <Poker3DCinematicTable />
        <PokerCinematicFX />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/8 bg-black/35 px-4 py-3 font-mono text-[8px] uppercase tracking-[.2em] text-white/35">
        <span>Cards · Chips · Turn ring · Showdown · Win reveal</span>
        <span className="text-amber-200/60">PLAY MONEY ONLY</span>
      </motion.div>
    </section>
  );
}

function Status({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[.025] px-3 py-2">
      <div className="flex items-center gap-2"><span className={tone}>{icon}</span><span className="font-mono text-[7px] font-black tracking-[.2em] text-white/35">{title}</span></div>
      <div className={`mt-1 font-mono text-[8px] font-black tracking-[.16em] ${tone}`}>{value}</div>
    </div>
  );
}
