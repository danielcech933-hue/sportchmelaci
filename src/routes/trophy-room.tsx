import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Crown, Gem, Lock, Medal, Sparkles, Star, Trophy, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/trophy-room")({ component: TrophyRoomPage });

const TIERS = [
  { value: 100, label: "ROOKIE", tone: "border-slate-400/25 bg-white/[.025]", icon: Medal },
  { value: 500, label: "CONTENDER", tone: "border-cyan-300/30 bg-cyan-300/[.035]", icon: Gem },
  { value: 1000, label: "ELITE", tone: "border-violet-300/35 bg-violet-300/[.04]", icon: Star },
  { value: 2000, label: "MASTER", tone: "border-amber-300/40 bg-amber-300/[.05]", icon: Trophy },
  { value: 5000, label: "LEGEND", tone: "border-orange-300/40 bg-orange-300/[.05]", icon: Crown },
  { value: 10000, label: "MYTHIC", tone: "border-fuchsia-300/45 bg-fuchsia-300/[.055]", icon: Sparkles },
];

const CATEGORIES = [
  { title: "WIN ENGINE", eyebrow: "VICTORIES", icon: Trophy, items: ["FIRST BLOOD", "TEN WINS", "CENTURION", "DOMINATOR"] },
  { title: "IRON STREAK", eyebrow: "FORM", icon: Zap, items: ["3 IN A ROW", "7 IN A ROW", "10 IN A ROW", "UNBREAKABLE"] },
  { title: "SPORT MASTER", eyebrow: "DISCIPLINES", icon: Medal, items: ["MULTI-SPORT", "SPECIALIST", "ALL-ROUNDER", "SPORT ICON"] },
  { title: "HIGH STAKES", eyebrow: "SĀZKY", icon: Gem, items: ["FIRST BET", "HIGH ROLLER", "JACKPOT", "HOUSE BREAKER"] },
];

function TrophyRoomPage() {
  const { nickname, user } = useAuth();
  const displayName = nickname ?? (user ? "PLAYER" : "GUEST");

  return (
    <main className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#030507] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,200,55,.13),transparent_28%),radial-gradient(circle_at_10%_65%,rgba(30,180,255,.08),transparent_30%),radial-gradient(circle_at_90%_70%,rgba(170,70,255,.09),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[.055] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-black/55 p-5 shadow-[0_35px_140px_-60px_rgba(255,200,55,.65)] backdrop-blur-2xl sm:p-8">
          <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="absolute -right-20 top-8 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.5fr_.8fr] lg:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[.32em] text-amber-300/80">
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1">PLAYER PRESTIGE SYSTEM</span>
                <span className="text-white/25">/</span>
                <span className="text-cyan-300/80">ULTRA S+</span>
              </div>
              <h1 className="font-display text-5xl uppercase leading-none tracking-[.035em] text-white sm:text-7xl">
                TROPHY <span className="text-amber-300 [text-shadow:0_0_30px_rgba(255,204,68,.35)]">ROOM</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/48 sm:text-base">
                Prestigovní centrum hráče. Od prvních 100 výkonových bodů až po MYTHIC úroveň. Každý tier má vlastní vizuální podpis, status a prostor pro další rekordy.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/profile" className="inline-flex items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[.2em] text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-300/15">Profil hráče</Link>
                <Link to="/records" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[.2em] text-white/60 transition hover:border-cyan-300/30 hover:text-white">Síň rekordů</Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-inner shadow-white/[.03]">
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[.24em] text-white/35"><span>CURRENT PLAYER</span><span>LIVE</span></div>
              <div className="mt-4 flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 shadow-[0_0_35px_-12px_rgba(255,204,68,.7)]"><Crown className="h-8 w-8 text-amber-300" /></div>
                <div className="min-w-0"><div className="truncate font-display text-2xl tracking-wider text-white">{displayName}</div><div className="font-mono text-[9px] uppercase tracking-[.24em] text-amber-300">PRESTIGE TRACK // {user ? "CONNECTED" : "GUEST VIEW"}</div></div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[.06]"><motion.div className="h-full w-[68%] bg-gradient-to-r from-cyan-300 via-amber-300 to-fuchsia-300 shadow-[0_0_18px_rgba(255,204,68,.55)]" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.2, repeat: Infinity }} /></div>
              <div className="mt-2 flex justify-between font-mono text-[8px] uppercase tracking-[.18em] text-white/25"><span>MASTER TRACK</span><span>68% TO MYTHIC</span></div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-3"><div><div className="font-mono text-[9px] font-black uppercase tracking-[.28em] text-amber-300/60">PRESTIGE LADDER</div><h2 className="mt-1 font-display text-3xl tracking-wider text-white">SIX TIERS. ONE LEGACY.</h2></div><div className="font-mono text-[9px] uppercase tracking-[.22em] text-white/25">100 → 10 000</div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {TIERS.map((tier, index) => { const Icon = tier.icon; const active = index === 3; return <motion.article key={tier.value} whileHover={{ y: -5 }} className={`relative overflow-hidden rounded-2xl border p-4 ${tier.tone} ${active ? "ring-1 ring-amber-300/35 shadow-[0_0_45px_-20px_rgba(255,204,68,.7)]" : ""}`}><div className="absolute right-3 top-3 font-mono text-[8px] text-white/20">0{index + 1}</div><div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/30"><Icon className="h-5 w-5 text-amber-200" /></div><div className="mt-4 font-display text-lg tracking-wider text-white">{tier.label}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[.2em] text-white/30">{tier.value.toLocaleString("cs-CZ")} XP</div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className={`h-full rounded-full ${active ? "w-[68%] bg-amber-300" : "w-[10%] bg-white/15"}`} /></div><div className="mt-2 flex items-center justify-between"><span className={`rounded-full px-2 py-0.5 font-mono text-[7px] font-black uppercase tracking-[.18em] ${active ? "border border-amber-300/30 bg-amber-300/10 text-amber-200" : "border border-white/8 bg-white/[.025] text-white/30"}`}>{active ? "CURRENT" : index < 3 ? "UNLOCKED" : "LOCKED"}</span>{index > 3 && <Lock className="h-3.5 w-3.5 text-white/20" />}</div></motion.article>; })}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-black/40 p-5 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between"><div><div className="font-mono text-[9px] uppercase tracking-[.28em] text-cyan-300/60">ACHIEVEMENT NETWORK</div><h2 className="mt-1 font-display text-3xl tracking-wider">SIGNATURE BADGES</h2></div><Sparkles className="h-5 w-5 text-amber-300" /></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{CATEGORIES.map((category) => { const Icon = category.icon; return <div key={category.title} className="rounded-2xl border border-white/8 bg-white/[.018] p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[.06]"><Icon className="h-4.5 w-4.5 text-cyan-200" /></div><div><div className="font-mono text-[8px] uppercase tracking-[.22em] text-cyan-300/55">{category.eyebrow}</div><div className="font-display text-lg tracking-wider">{category.title}</div></div></div><div className="mt-4 grid grid-cols-2 gap-2">{category.items.map((item, i) => <div key={item} className="rounded-xl border border-white/7 bg-black/30 px-3 py-3"><div className="flex items-center justify-between"><span className="font-mono text-[8px] font-black tracking-[.16em] text-white/65">{item}</span>{i < 2 ? <span className="text-[8px] text-amber-300">ACTIVE</span> : <Lock className="h-3 w-3 text-white/20" />}</div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[.06]"><div className={`h-full rounded-full ${i < 2 ? "w-[72%] bg-cyan-300" : "w-0 bg-white/10"}`} /></div></div>)}</div></div>; })}</div>
          </div>

          <aside className="rounded-[28px] border border-amber-300/15 bg-gradient-to-br from-amber-300/[.07] via-black/45 to-violet-400/[.05] p-5 sm:p-6">
            <div className="font-mono text-[9px] uppercase tracking-[.28em] text-amber-300/60">NEXT UNLOCK</div>
            <h2 className="mt-2 font-display text-4xl tracking-wider">MASTER II</h2>
            <p className="mt-2 text-sm leading-6 text-white/40">Dokonči další výkonové milníky a odemkni nové badge frames, profile effects a prestižní titulky.</p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-4"><div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[.2em] text-white/30">PROGRESS</span><span className="font-mono text-[11px] text-amber-200">1 360 / 2 000</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]"><motion.div className="h-full w-[68%] bg-gradient-to-r from-amber-300 to-fuchsia-300" animate={{ width: ["66%", "70%", "68%"] }} transition={{ duration: 2.4, repeat: Infinity }} /></div><div className="mt-2 flex justify-between font-mono text-[8px] uppercase tracking-[.18em] text-white/22"><span>MASTER</span><span>680 XP LEFT</span></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2">{["PROFILE FX", "TITLE", "BADGE FRAME"].map((label) => <div key={label} className="rounded-xl border border-white/8 bg-black/25 p-3 text-center"><Star className="mx-auto h-3.5 w-3.5 text-amber-300/80" /><div className="mt-2 font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{label}</div></div>)}</div>
          </aside>
        </section>

        <section className="mt-8 rounded-3xl border border-white/8 bg-black/35 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/[.07]"><Trophy className="h-4 w-4 text-amber-300" /></div><div className="font-mono text-[9px] uppercase tracking-[.22em] text-white/35">TROPHY ROOM // LIVE PRESTIGE LAYER</div><div className="ml-auto font-mono text-[8px] uppercase tracking-[.2em] text-cyan-300/60">Profile-ready · responsive · cinematic</div></div></section>
      </div>
    </main>
  );
}
