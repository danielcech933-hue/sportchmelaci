import { Crown, Flame, Gamepad2, Gem, Shield, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";

type ProfileStats = {
  total: number;
  victories: number;
  losses: number;
  betWon: number;
  betLost: number;
  biggestBet: number;
  sports: number;
  moneyNet: number;
};

const thresholds = [0, 250, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000, 400000];
const titles = ["NOVÁČEK", "ROOKIE", "COMPETITOR", "CONTENDER", "VETERÁN", "ELITA", "MASTER", "CHAMPION", "LEGEND", "MYTHIC", "GODLIKE", "GOD MODE"];

function progression(stats: ProfileStats) {
  const xp = stats.victories * 100 + stats.total * 25 + (stats.betWon + stats.betLost) * 10 + stats.sports * 100;
  const level = Math.min(thresholds.length - 1, thresholds.reduce((acc, threshold, index) => xp >= threshold ? index : acc, 0));
  const next = thresholds[level + 1];
  const progress = next ? Math.min(100, Math.round(((xp - thresholds[level]) / (next - thresholds[level])) * 100)) : 100;
  return { xp, level: level + 1, title: titles[level], progress, next };
}

export function ProfilePlayerCard({ nickname, stats }: { nickname: string | null; stats: ProfileStats }) {
  const p = progression(stats);
  const winRate = stats.total ? Math.round((stats.victories / stats.total) * 100) : 0;
  const candidate = [
    { score: stats.victories, label: "CHAMPION", icon: Trophy, tone: "border-amber-300/60 bg-amber-300/10 text-amber-200" },
    { score: stats.total, label: "VETERAN", icon: Gamepad2, tone: "border-sky-300/60 bg-sky-300/10 text-sky-200" },
    { score: stats.biggestBet, label: "HIGH ROLLER", icon: Gem, tone: "border-fuchsia-300/60 bg-fuchsia-300/10 text-fuchsia-200" },
    { score: stats.sports, label: "MULTISPORT", icon: Zap, tone: "border-emerald-300/60 bg-emerald-300/10 text-emerald-200" },
  ].sort((a, b) => b.score - a.score)[0];
  const FavoriteIcon = candidate.icon;

  return (
    <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-primary/30 bg-[#06090c]/95 shadow-[0_30px_90px_-45px_var(--color-primary)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,hsl(var(--primary)/.20),transparent_32%),radial-gradient(circle_at_100%_100%,hsl(280_80%_60%/.12),transparent_36%)]" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="relative mx-auto grid h-28 w-28 place-items-center rounded-[2rem] border border-primary/40 bg-primary/[0.06] shadow-[0_0_55px_-18px_var(--color-primary)] lg:mx-0">
          <div className="absolute inset-2 rounded-[1.55rem] border border-primary/20" />
          <div className="absolute -inset-1 rounded-[2.1rem] border border-primary/10 animate-pulse" />
          <Crown className="h-9 w-9 text-primary" />
          <span className="absolute -bottom-3 rounded-full border border-primary/30 bg-background px-3 py-1 font-mono text-[9px] font-bold tracking-[0.22em] text-primary">LVL {p.level}</span>
        </div>

        <div className="min-w-0 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[9px] font-bold tracking-[0.2em] text-primary"><Star className="h-3 w-3" /> PLAYER CARD</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-white/45">{p.title}</span>
          </div>
          <h2 className="mt-2 truncate font-display text-3xl tracking-[0.08em] text-white sm:text-4xl">{nickname ?? "PLAYER"}</h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/35">SportChmeláci · Competitive Identity</p>
          <div className="mt-4 max-w-xl">
            <div className="mb-1.5 flex justify-between font-mono text-[8px] uppercase tracking-[0.18em] text-white/35"><span>{p.xp.toLocaleString("cs-CZ")} XP</span><span>{p.next ? `${p.next.toLocaleString("cs-CZ")} XP DO DALŠÍHO LEVELU` : "MAX LEVEL"}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-primary via-amber-300 to-fuchsia-400 shadow-[0_0_20px_-3px_currentColor] transition-all duration-700" style={{ width: `${p.progress}%` }} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 lg:min-w-[180px]">
          <Mini label="WIN RATE" value={`${winRate}%`} icon={Trophy} />
          <Mini label="WINS" value={stats.victories.toLocaleString("cs-CZ")} icon={Flame} />
          <Mini label="SPORTY" value={stats.sports.toLocaleString("cs-CZ")} icon={Gamepad2} />
          <Mini label="NET $" value={`${stats.moneyNet >= 0 ? "+" : ""}${stats.moneyNet.toFixed(0)}`} icon={Target} />
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/20 px-5 py-4 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><div><p className="font-mono text-[8px] uppercase tracking-[0.22em] text-primary/70">SIGNATURE ACHIEVEMENT</p><p className="font-display text-sm tracking-[0.14em] text-white">{candidate.label}</p></div></div>
          <div className={`inline-flex items-center gap-2 self-start rounded-xl border px-3 py-2 sm:self-auto ${candidate.tone}`}><FavoriteIcon className="h-4 w-4" /><span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">{candidate.score.toLocaleString("cs-CZ")} PROGRESS</span><Sparkles className="h-3.5 w-3.5" /></div>
        </div>
      </div>
    </section>
  );
}

function Mini({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Trophy }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-1.5 text-white/30"><Icon className="h-3 w-3" /><span className="font-mono text-[8px] tracking-[0.16em]">{label}</span></div><p className="mt-1 font-display text-lg text-white">{value}</p></div>;
}
