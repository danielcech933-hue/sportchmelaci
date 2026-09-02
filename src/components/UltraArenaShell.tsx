import type { ReactNode } from "react";
import { Activity, ArrowUpRight, Clock3, Radio, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function UltraArenaShell({
  eyebrow,
  title,
  accent = "amber",
  subtitle,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: "amber" | "cyan" | "violet";
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const accentClass = {
    amber: "text-amber-200 border-amber-300/30 shadow-[0_0_90px_rgba(245,190,60,.10)]",
    cyan: "text-cyan-200 border-cyan-300/30 shadow-[0_0_90px_rgba(34,211,238,.10)]",
    violet: "text-violet-200 border-violet-300/30 shadow-[0_0_90px_rgba(167,139,250,.10)]",
  }[accent];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,200,80,.11),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(34,211,238,.07),transparent_25%),linear-gradient(180deg,#030711_0%,#02050a_48%,#010307_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.075] [background-image:linear-gradient(rgba(255,255,255,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none fixed left-1/2 top-20 h-72 w-[70vw] -translate-x-1/2 rounded-full bg-amber-300/[.035] blur-[110px]" />

      <div className="relative mx-auto max-w-[1500px] px-3 pb-20 pt-4 sm:px-5 sm:pt-6 lg:px-8">
        <section className={cn("relative overflow-hidden rounded-[32px] border bg-black/45 p-4 backdrop-blur-2xl sm:p-7 lg:p-8", accentClass)}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_20%,rgba(255,255,255,.08),transparent_18%),radial-gradient(circle_at_76%_14%,rgba(255,204,68,.08),transparent_23%),linear-gradient(115deg,transparent_20%,rgba(255,255,255,.025)_48%,transparent_75%)]" />
          <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full border border-white/[.04] bg-white/[.015] blur-sm" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[0.30em] text-white/45 sm:text-[9px]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[.06] px-2.5 py-1 text-amber-100/85 shadow-[0_0_22px_rgba(245,190,60,.08)]">
                  <Sparkles className="h-3 w-3" /> CHMELOVÍ SPORTOVCI
                </span>
                <span className="h-px w-5 bg-white/15" />
                <span className="truncate">{eyebrow}</span>
              </div>
              <h1 className="mt-3 max-w-5xl font-display text-4xl font-black leading-[.92] tracking-[0.055em] text-white drop-shadow-[0_0_25px_rgba(255,255,255,.05)] sm:text-6xl lg:text-7xl xl:text-[5rem]">{title}</h1>
              {subtitle ? <p className="mt-4 max-w-3xl text-[13px] leading-6 text-white/48 sm:text-sm sm:leading-7 lg:text-[15px]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="relative flex flex-wrap gap-2 lg:max-w-md lg:justify-end">{actions}</div> : null}
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Signal label="ŽIVÝ SYSTÉM" value="ONLINE" icon={<Radio className="h-3.5 w-3.5" />} tone="emerald" />
            <Signal label="ZÁPASY" value="V REÁLNÉM ČASE" icon={<Activity className="h-3.5 w-3.5" />} />
            <Signal label="VÝSLEDKY" value="OVĚŘENÉ" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
            <Signal label="KOMUNITA" value="AKTIVNÍ" icon={<Trophy className="h-3.5 w-3.5" />} tone="amber" />
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}

function Signal({ label, value, icon, tone = "cyan" }: { label: string; value: string; icon: ReactNode; tone?: "cyan" | "emerald" | "amber" }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[.025] px-3 py-2.5 backdrop-blur-xl transition hover:border-white/15 hover:bg-white/[.04]">
      <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[.18em] text-white/35 sm:text-[8px]">{icon}{label}</div>
      <div className={cn("mt-1 font-mono text-[10px] font-black tracking-[.12em] sm:text-xs", tone === "amber" ? "text-amber-200" : tone === "emerald" ? "text-emerald-300" : "text-cyan-200")}>{value}</div>
    </div>
  );
}

export function UltraSection({ title, kicker, icon, action, children, className }: { title: string; kicker?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("relative mt-6 overflow-hidden rounded-[27px] border border-white/10 bg-black/30 p-3.5 backdrop-blur-2xl sm:p-5", className)}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/55 to-transparent" />
      <div className="absolute inset-x-8 top-0 h-16 bg-[radial-gradient(ellipse_at_top,rgba(245,190,60,.07),transparent_65%)] blur-2xl" />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.30em] text-amber-200/60">{icon}{kicker ?? "PŘEHLED"}</div>
          <h2 className="mt-1 font-display text-xl font-black tracking-[.08em] text-white sm:text-2xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function UltraMetric({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.055] to-black/30 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/25 hover:shadow-[0_18px_45px_-32px_rgba(245,190,60,.65)]">
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-[8px] uppercase tracking-[.22em] text-white/35">{label}</span>{icon}</div>
      <div className="mt-2 font-display text-2xl font-black tracking-wider text-amber-100 sm:text-[1.7rem]">{value}</div>
      {hint ? <div className="mt-1 text-[10px] leading-4 text-white/35">{hint}</div> : null}
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-amber-200/10 blur-2xl transition group-hover:bg-amber-200/20" />
    </div>
  );
}

export function UltraLinkButton({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a href={href} className={cn(
      "group inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-[.18em] transition duration-200 hover:-translate-y-0.5 active:translate-y-0",
      primary
        ? "border-amber-300/55 bg-amber-300/[.12] text-amber-100 shadow-[0_0_32px_rgba(245,190,60,.16)] hover:border-amber-200/70 hover:bg-amber-300/[.19] hover:shadow-[0_0_42px_rgba(245,190,60,.22)]"
        : "border-white/10 bg-white/[.03] text-white/60 hover:border-white/20 hover:bg-white/[.055] hover:text-white"
    )}>
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}

export function LiveBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[.16em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,.65)]" /> ŽIVĚ</span>;
}

export function TimeBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.03] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[.16em] text-white/40"><Clock3 className="h-3 w-3" />{children}</span>;
}

export function PowerMark() {
  return <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-200 shadow-[0_0_28px_rgba(245,190,60,.16)]"><Zap className="h-4 w-4" /></span>;
}
