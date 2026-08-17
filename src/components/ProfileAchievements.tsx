import { useEffect, useMemo, useState } from "react";
import { Award, Check, Crown, Flame, Gamepad2, Lock, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatches } from "@/lib/matches-db";
import { sideOf, winnerSideOf } from "@/lib/stats";
import type { Match } from "@/lib/matches";

type Tier = { value: number; label: string };
type Category = "vitezstvi" | "zapasy" | "serie" | "sazky" | "sporty" | "special";

type Stats = { wins: number; matches: number; bets: number; sports: number; bestStreak: number };

const tiers: Tier[] = [
  { value: 1, label: "Nováček" }, { value: 3, label: "Bronz" }, { value: 5, label: "Stříbro" },
  { value: 10, label: "Zlato" }, { value: 25, label: "Elita" }, { value: 50, label: "Mistr" },
  { value: 100, label: "Legenda" }, { value: 200, label: "Ikona" }, { value: 500, label: "HALL OF FAME" },
  { value: 1000, label: "MYTHIC" }, { value: 2000, label: "GOD MODE" },
];

const categoryMeta: Record<Category, { title: string; icon: typeof Trophy; badgeClass: string }> = {
  vitezstvi: { title: "VÝHRY", icon: Trophy, badgeClass: "border-amber-400/70 bg-amber-400/10 text-amber-300" },
  zapasy: { title: "ODEHRANÉ ZÁPASY", icon: Gamepad2, badgeClass: "border-blue-400/70 bg-blue-400/10 text-blue-300" },
  serie: { title: "VÍTĚZNÉ SÉRIE", icon: Flame, badgeClass: "border-purple-400/70 bg-purple-400/10 text-purple-300" },
  sazky: { title: "SÁZKAŘ", icon: Target, badgeClass: "border-red-400/70 bg-red-400/10 text-red-300" },
  sporty: { title: "MULTISPORT", icon: Zap, badgeClass: "border-emerald-400/70 bg-emerald-400/10 text-emerald-300" },
  special: { title: "SPECIÁLNÍ ODZNAKY", icon: Crown, badgeClass: "border-yellow-300/70 bg-yellow-300/10 text-yellow-200" },
};

function valueFor(category: Category, stats: Stats) {
  if (category === "vitezstvi") return stats.wins;
  if (category === "zapasy") return stats.matches;
  if (category === "serie") return stats.bestStreak;
  if (category === "sazky") return stats.bets;
  if (category === "sporty") return stats.sports;
  return stats.wins >= 100 ? 3 : stats.wins >= 25 ? 2 : stats.wins >= 1 ? 1 : 0;
}

function BadgeVisual({ value, badgeClass, locked }: { value: string; badgeClass: string; locked: boolean }) {
  return (
    <div className={`relative mx-auto grid h-24 w-24 place-items-center rounded-[30%] border-2 shadow-[0_12px_40px_-14px_currentColor] transition duration-300 group-hover:scale-105 group-hover:-rotate-2 ${locked ? "border-white/10 bg-white/[0.025] text-white/25" : badgeClass}`}>
      <div className="absolute inset-2 rounded-[27%] border border-current/20" />
      <div className="absolute inset-4 rounded-[23%] border border-current/15" />
      <span className="relative font-display text-xl font-black tracking-tight">{value}</span>
      {locked ? <Lock className="absolute right-2 top-2 h-3.5 w-3.5" /> : <Check className="absolute right-2 top-2 h-3.5 w-3.5" />}
      <span className="absolute -bottom-2 rounded-full border border-current/25 bg-background px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em]">{locked ? "LOCKED" : "EARNED"}</span>
    </div>
  );
}

export function ProfileAchievements({ userId }: { userId: string }) {
  const [nickname, setNickname] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<"all" | Category>("all");

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle(),
      fetchAllMatches(),
    ]).then(([profileResult, allMatches]) => {
      if (!active) return;
      setNickname(profileResult.data?.nickname ?? null);
      setMatches(allMatches);
    });
    return () => { active = false; };
  }, [userId]);

  const stats = useMemo<Stats>(() => {
    if (!nickname) return { wins: 0, matches: 0, bets: 0, sports: 0, bestStreak: 0 };
    const mine = matches.filter((m) => sideOf(nickname, m) !== null).sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt));
    let wins = 0, streak = 0, bestStreak = 0, betCount = 0;
    for (const m of mine) {
      const outcome = winnerSideOf(m);
      if (outcome === sideOf(nickname, m)) { wins++; streak++; bestStreak = Math.max(bestStreak, streak); }
      else if (outcome) streak = 0;
      for (const bet of m.bets ?? []) if (bet.bettor?.toLowerCase() === nickname.toLowerCase()) betCount++;
    }
    return { wins, matches: mine.length, bets: betCount, sports: new Set(mine.map((m) => m.sport)).size, bestStreak };
  }, [matches, nickname]);

  const categories = filter === "all" ? (Object.keys(categoryMeta) as Category[]) : [filter];
  const earnedCount = categories.reduce((sum, category) => sum + tiers.filter((tier) => valueFor(category, stats) >= tier.value).length, 0);
  const totalCount = categories.length * tiers.length;

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-primary/25 bg-[#070a0c]/90 shadow-[0_30px_100px_-45px_var(--color-primary)] backdrop-blur-xl">
      <div className="relative border-b border-white/10 p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--primary)/.18),transparent_35%),radial-gradient(circle_at_85%_20%,hsl(280_80%_60%/.10),transparent_30%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_30px_-8px_var(--color-primary)]"><Award className="h-6 w-6" /></div><div><p className="font-mono text-[9px] uppercase tracking-[0.35em] text-primary/80">PLAYER PROGRESSION // LIVE</p><h2 className="font-display text-3xl tracking-[0.12em] text-white sm:text-4xl">ODZNAKY</h2></div></div>
            <p className="mt-2 max-w-2xl text-xs text-white/45">Progresní odznaky od prvního vítězství až po 2 000+ milník. Každý stupeň má vlastní raritu, glow a status.</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-right"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">COLLECTION</p><p className="font-display text-2xl text-amber-200">{earnedCount}<span className="text-white/25"> / {totalCount}</span></p></div>
        </div>
        <div className="relative mt-5 flex gap-2 overflow-x-auto pb-1">
          {(["all", ...Object.keys(categoryMeta)] as const).map((key) => { const meta = key === "all" ? null : categoryMeta[key]; const Icon = meta?.icon ?? Sparkles; return <button key={key} onClick={() => setFilter(key as "all" | Category)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${filter === key ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_25px_-12px_var(--color-primary)]" : "border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/70"}`}><Icon className="h-3.5 w-3.5" />{key === "all" ? "Vše" : meta.title}</button>; })}
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {categories.map((category) => {
          const meta = categoryMeta[category]; const Icon = meta.icon; const current = valueFor(category, stats);
          return <div key={category} className="mb-9 last:mb-0">
            <div className="mb-4 flex items-center gap-3"><Icon className="h-4 w-4 text-primary" /><h3 className="font-display text-lg tracking-[0.2em] text-white/85">{meta.title}</h3><div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" /><span className="font-mono text-[9px] text-white/30">{current.toLocaleString("cs-CZ")} / NEXT</span></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
              {tiers.map((tier, index) => { const earned = current >= tier.value; const rarity = index >= 10 ? "MYTHIC" : index >= 8 ? "LEGENDARY" : index >= 6 ? "EPIC" : index >= 4 ? "RARE" : "COMMON"; const badgeValue = tier.value >= 1000 ? `${tier.value / 1000}K` : tier.value.toLocaleString("cs-CZ"); return <div key={`${category}-${tier.value}`} className={`group rounded-2xl border p-3 text-center transition duration-300 hover:-translate-y-1 ${earned ? "border-white/10 bg-white/[0.035]" : "border-white/[0.06] bg-black/20 opacity-70"}`}><BadgeVisual value={badgeValue} badgeClass={meta.badgeClass} locked={!earned} /><p className="mt-4 truncate font-display text-xs tracking-wider text-white/80">{tier.label}</p><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-white/30">{rarity} · {tier.value.toLocaleString("cs-CZ")}</p></div>; })}
            </div>
          </div>;
        })}

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[{ icon: Sparkles, title: "Skryté výzvy", text: "Noční vlk, Poker Face, All In, High Roller a další speciální odznaky." }, { icon: Crown, title: "Rarity systém", text: "Common → Rare → Epic → Legendary → Mythic. Vyšší stupeň = výraznější vizuál." }, { icon: Zap, title: "Live progres", text: "Odznaky se odemykají z reálných výsledků profilu, ne z ručně nastavených hodnot." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 font-display text-sm tracking-wider text-white/85">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-white/35">{text}</p></div>)}
        </div>
      </div>
    </section>
  );
}
