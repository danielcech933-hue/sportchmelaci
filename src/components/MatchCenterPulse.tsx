import { Activity, Clock3, Flame, Radio, ShieldCheck, Swords, Zap } from "lucide-react";
import type { Match } from "@/lib/matches";
import { SPORTS } from "@/lib/matches";

function setsWon(match: Match, side: "a" | "b") {
  return match.sets.filter((s) => (side === "a" ? s.a > s.b : s.b > s.a)).length;
}

function buildPulse(match: Match) {
  const a = match.scoreA + setsWon(match, "a") * 2;
  const b = match.scoreB + setsWon(match, "b") * 2;
  const total = Math.max(1, a + b);
  return Math.round((a / total) * 100);
}

export function MatchCenterPulse({ match }: { match: Match }) {
  const cfg = SPORTS[match.sport];
  const ended = Boolean(match.endedAt);
  const pulse = buildPulse(match);
  const edge = Math.min(100, Math.max(0, pulse));
  const status = ended ? "FINALIZED" : "LIVE TELEMETRY";
  const eventItems = [
    { label: "MATCH CREATED", value: new Date(match.startedAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }), icon: Clock3 },
    ...match.sets.map((set, index) => ({ label: `${cfg.setLabel.toUpperCase()} ${index + 1}`, value: `${set.a}:${set.b}`, icon: Swords })),
    { label: "CURRENT SCORE", value: `${match.scoreA}:${match.scoreB}`, icon: Radio },
  ];

  return (
    <section className="mt-4 overflow-hidden rounded-[24px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(7,15,22,.96),rgba(2,7,10,.98))] shadow-[0_28px_90px_-54px_rgba(34,211,238,.6)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200"><Activity className="h-4 w-4" /></span>
          <div><div className="aaa-meta text-cyan-200/70">MATCH CENTER 3.0</div><div className="font-display text-lg tracking-[.12em] text-white">LIVE PULSE</div></div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.2em] ${ended ? "border-white/10 bg-white/[.03] text-white/35" : "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${ended ? "bg-white/25" : "animate-pulse bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]"}`} />{status}</span>
          <span className="hidden rounded-full border border-amber-300/15 bg-amber-300/5 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.2em] text-amber-200/70 sm:inline-flex"><ShieldCheck className="h-3 w-3" /> SERVER DATA</span>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3"><div><div className="aaa-meta">MOMENTUM INDEX</div><div className="mt-1 font-display text-2xl tracking-[.08em] text-white">TEAM A <span className="text-white/20">vs</span> TEAM B</div></div><div className="font-mono text-[10px] font-black text-cyan-200">{edge}%</div></div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/6 p-[2px]"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-cyan-500 shadow-[0_0_22px_-8px_rgba(34,211,238,.9)] transition-all duration-700" style={{ width: `${edge}%` }} /></div>
          <div className="mt-2 flex justify-between font-mono text-[7px] uppercase tracking-[.18em] text-white/25"><span>{match.teamA}</span><span>{match.teamB}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><Metric label="A SCORE" value={match.scoreA} tone="gold"/><Metric label="B SCORE" value={match.scoreB} tone="cyan"/><Metric label="SETS" value={`${setsWon(match,"a")}:${setsWon(match,"b")}`} tone="neutral"/></div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-amber-200"/><div><div className="aaa-meta text-amber-200/65">MATCH TIMELINE</div><div className="font-display text-lg tracking-[.1em] text-white">LIVE EVENTS</div></div></div>
          <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1">{eventItems.slice(-6).reverse().map((event, index) => { const Icon = event.icon; return <div key={`${event.label}-${event.value}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/7 bg-white/[.02] px-3 py-2"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-300/5 text-cyan-200"><Icon className="h-3.5 w-3.5"/></div><div className="min-w-0 flex-1"><div className="aaa-meta">{event.label}</div><div className="truncate font-mono text-[10px] font-bold text-white/65">{event.value}</div></div></div> })}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-white/8 sm:grid-cols-4">
        <FooterSignal label="SPORT" value={cfg.name.toUpperCase()} icon={<Zap className="h-3.5 w-3.5" />} />
        <FooterSignal label="FORMAT" value={match.matchFormat === "2v2" ? "2V2 TEAM" : "1V1 SOLO"} icon={<Swords className="h-3.5 w-3.5" />} />
        <FooterSignal label="OWNER" value={match.ownerNickname.toUpperCase()} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <FooterSignal label="SIGNAL" value={ended ? "LOCKED" : "ACTIVE"} icon={<Radio className="h-3.5 w-3.5" />} />
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: "gold" | "cyan" | "neutral" }) {
  const cls = tone === "gold" ? "text-amber-100" : tone === "cyan" ? "text-cyan-100" : "text-white";
  return <div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><div className="aaa-meta">{label}</div><div className={`mt-1 font-display text-2xl tracking-[.05em] ${cls}`}>{value}</div></div>;
}

function FooterSignal({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center gap-2 border-r border-white/8 px-4 py-3 last:border-r-0"><span className="text-cyan-200/55">{icon}</span><div className="min-w-0"><div className="aaa-meta">{label}</div><div className="truncate font-mono text-[9px] font-bold text-white/55">{value}</div></div></div>;
}
