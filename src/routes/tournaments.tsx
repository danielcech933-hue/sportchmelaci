import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Plus, ShieldCheck, Sparkles, Trophy, Users, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SPORTS, type SportId } from "@/lib/matches";
import { SportOptions } from "@/components/SportFilterBar";
import { NICKNAMES_DATALIST_ID, NicknamesDatalist, useNicknames } from "@/lib/nicknames";
import { StateBlock, SkeletonRows } from "@/components/ui-kit";
import { createTournament, deleteTournament, fetchTournaments, type Tournament, type TournamentFormat } from "@/lib/tournaments-db";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection, TimeBadge } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/tournaments")({
  head: () => ({ meta: [{ title: "Turnaje — Chmeloví Sportovci" }, { name: "description", content: "Prémiový hub turnajů, rozpisů, tabulek a vyřazovacích pavouků." }] }),
  component: TournamentsPage,
});

type TournamentFormatOption = { id: TournamentFormat; label: string; hint: string };
const FORMATS: TournamentFormatOption[] = [
  { id: "round_robin", label: "Každý s každým", hint: "Každý účastník odehraje více duelů." },
  { id: "single_elimination", label: "Vyřazovací pavouk", hint: "Přímý postup přes jednotlivá kola." },
];

function localDateTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function TournamentsPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const nicknames = useNicknames();
  const [list, setList] = useState<Tournament[]>([]);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<SportId>("tennis");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [count, setCount] = useState(4);
  const [teams, setTeams] = useState<string[]>(["", "", "", ""]);
  const [rosters, setRosters] = useState<string[][]>([[""], [""], [""], [""]]);
  const [when, setWhen] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return localDateTime(d); });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => { try { setList(await fetchTournaments()); } catch { setList([]); } };
  useEffect(() => { void load(); }, []);

  function setSize(n: number) {
    const size = Math.max(2, Math.min(32, Number.isFinite(n) ? n : 2));
    setCount(size);
    setTeams((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? ""));
    setRosters((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? [""]));
  }
  function setTeam(i: number, value: string) { setTeams((prev) => prev.map((x, j) => j === i ? value : x)); }
  function setPlayer(ti: number, pi: number, value: string) { setRosters((prev) => prev.map((r, i) => i === ti ? r.map((p, j) => j === pi ? value : p) : r)); }
  function addPlayer(ti: number) { setRosters((prev) => prev.map((r, i) => i === ti ? [...r, ""] : r)); }
  function removePlayer(ti: number, pi: number) { setRosters((prev) => prev.map((r, i) => i === ti ? (r.length > 1 ? r.filter((_, j) => j !== pi) : [""]) : r)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const filled = teams.map((t, i) => ({ name: t.trim(), index: i })).filter((x) => x.name);
    if (filled.length < 2) { setErr("Zadej alespoň 2 účastníky."); return; }
    if (new Set(filled.map((x) => x.name.toLowerCase())).size !== filled.length) { setErr("Účastníci se nesmí jmenovat stejně."); return; }
    setBusy(true); setErr(null);
    try {
      const ts = when ? new Date(when).getTime() : NaN;
      const id = await createTournament({
        name: name.trim() || "Chmelový turnaj",
        sport,
        format,
        teams: filled.map((x) => x.name),
        players: filled.map((x) => (rosters[x.index] ?? []).map((p) => p.trim()).filter(Boolean)),
        scheduledAt: Number.isNaN(ts) ? null : ts,
      });
      navigate({ to: "/tournament", search: { id } });
    } catch (e) {
      const message = (e as { message?: string })?.message ?? "Turnaj se nepodařilo vytvořit.";
      setErr(message.includes("not_admin") ? "Turnaj může založit pouze administrátor." : message);
    } finally { setBusy(false); }
  }

  const upcoming = useMemo(() => list.filter((t) => t.scheduledAt && t.scheduledAt > Date.now()).sort((a, b) => Number(a.scheduledAt) - Number(b.scheduledAt)), [list]);
  const formats = useMemo(() => list.reduce((acc, t) => { acc[t.format] = (acc[t.format] ?? 0) + 1; return acc; }, {} as Record<string, number>), [list]);

  if (loading) return <main className="mx-auto max-w-[1450px] px-4 py-8"><SkeletonRows rows={6} /></main>;

  return (
    <UltraArenaShell eyebrow="CHMELOVÍ SPORTOVCI · TOURNAMENT OPERATIONS" title="TURNAJE" subtitle="Centrum pro soutěže, pavouky a matchday. Založ turnaj, nastav účastníky a otevři jeho kompletní soutěžní stránku." actions={<><UltraLinkButton href="/schedule">PLÁN ZÁPASŮ</UltraLinkButton><UltraLinkButton href="/rankings" primary>SCOREBOARD</UltraLinkButton></>}>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UltraMetric label="TURNAJE" value={String(list.length)} hint="celkem evidovaných soutěží" icon={<Trophy className="h-4 w-4 text-amber-200" />} />
        <UltraMetric label="NAPLÁNOVÁNO" value={String(upcoming.length)} hint="budoucích startů" icon={<CalendarClock className="h-4 w-4 text-cyan-200" />} />
        <UltraMetric label="PAVOUK" value={String(formats.single_elimination ?? 0)} hint="vyřazovacích formátů" icon={<Zap className="h-4 w-4 text-violet-200" />} />
        <UltraMetric label="LIGA" value={String(formats.round_robin ?? 0)} hint="formátů každý s každým" icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />} />
      </div>

      <section className="mt-4 overflow-hidden rounded-[30px] border border-amber-300/18 bg-[radial-gradient(circle_at_80%_10%,rgba(250,204,21,.12),transparent_28%),radial-gradient(circle_at_15%_90%,rgba(34,211,238,.07),transparent_25%),rgba(0,0,0,.24)]">
        <div className="grid lg:grid-cols-[1fr_380px]">
          <div className="p-6 sm:p-9"><div className="aaa-meta text-amber-200/70">COMPETITIVE CALENDAR</div><h2 className="mt-3 font-display text-5xl font-black tracking-[.07em] text-white sm:text-6xl">NEXT <span className="gold-text">BATTLE</span></h2><p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">Nejbližší naplánovaný turnaj je vždy připravený jako první vstupní bod. Odtud se dostaneš přímo k pavouku, výsledkům a zápasům.</p><div className="mt-6 flex flex-wrap gap-2"><UltraLinkButton href="#create">NOVÝ TURNAJ</UltraLinkButton><UltraLinkButton href="/leagues" primary>CHMEL LEAGUE</UltraLinkButton></div></div>
          <aside className="border-t border-white/8 bg-black/20 p-6 sm:p-8 lg:border-l lg:border-t-0"><div className="aaa-meta text-cyan-200/70">NEJBLIŽŠÍ START</div>{upcoming[0] ? <Link to="/tournament" search={{ id: upcoming[0].id }} className="group mt-4 block rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-4 hover:border-cyan-300/30"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[8px] uppercase tracking-[.2em] text-cyan-200">{SPORTS[upcoming[0].sport]?.emoji} {SPORTS[upcoming[0].sport]?.name}</span><ChevronRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-1" /></div><div className="mt-3 truncate font-display text-2xl text-white">{upcoming[0].name}</div><div className="mt-2 flex items-center gap-2"><TimeBadge>{new Date(upcoming[0].scheduledAt!).toLocaleString("cs-CZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TimeBadge><span className="font-mono text-[8px] uppercase tracking-[.15em] text-white/25">{upcoming[0].format === "round_robin" ? "KAŽDÝ S KAŽDÝM" : "PAVOUK"}</span></div></Link> : <StateBlock state="empty" title="Žádný naplánovaný turnaj" hint="Až bude vytvořen další soutěžní event, objeví se zde." />}</aside>
        </div>
      </section>

      {isAdmin && <UltraSection title="ZALOŽIT NOVÝ TURNAJ" kicker="ADMIN · COMPETITION BUILDER" icon={<Plus className="h-4 w-4 text-amber-200" />} className="mt-4" >
        <form id="create" onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Název turnaje"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Chmelový pohár" /></Field>
            <Field label="Sport"><select value={sport} onChange={(e) => setSport(e.target.value as SportId)}><SportOptions /></select></Field>
            <Field label="Počet účastníků"><input type="number" min={2} max={32} value={count} onChange={(e) => setSize(Number(e.target.value))} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2"><Field label="Začátek turnaje"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field><div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="aaa-meta">ROZPIS</div><p className="mt-2 text-sm leading-6 text-white/35">Termín nastaví začátek generování duelů. Bez termínu zůstane soutěž otevřená bez pevného startu.</p></div></div>
          <div className="grid gap-3 md:grid-cols-2">{FORMATS.map((f) => <button key={f.id} type="button" onClick={() => setFormat(f.id)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${format === f.id ? "border-amber-300/45 bg-amber-300/[.08]" : "border-white/8 bg-white/[.02] hover:border-white/15"}`}><div className="flex items-center justify-between"><span className="font-display text-xl text-white">{f.label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${format === f.id ? "bg-amber-300 text-black" : "bg-white/[.05] text-white/35"}`}>{f.id === "round_robin" ? <Users className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}</span></div><p className="mt-2 text-sm text-white/30">{f.hint}</p></button>)}</div>
          <div><div className="aaa-meta">ÚČASTNÍCI A SOUPISKY</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{teams.map((team, i) => <div key={i} className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="mb-2 flex items-center justify-between"><span className="font-mono text-[8px] tracking-[.2em] text-white/25">ÚČASTNÍK {String(i + 1).padStart(2, "0")}</span>{i >= 2 && <button type="button" onClick={() => setTeams((prev) => prev.map((x, j) => j === i ? "" : x))} className="text-white/20 hover:text-rose-200" aria-label="Vyčistit účastníka"><X className="h-3.5 w-3.5" /></button>}</div><input value={team} list={NICKNAMES_DATALIST_ID} placeholder={`Tým / hráč ${i + 1}`} onChange={(e) => setTeam(i, e.target.value)} /><div className="mt-3 space-y-2">{(rosters[i] ?? [""]).map((p, j) => <div key={j} className="flex gap-2"><input value={p} list={NICKNAMES_DATALIST_ID} placeholder={`Hráč ${j + 1}`} onChange={(e) => setPlayer(i, j, e.target.value)} className="flex-1" />{(rosters[i]?.length ?? 1) > 1 && <button type="button" onClick={() => removePlayer(i, j)} className="grid w-10 place-items-center rounded-xl border border-white/8 text-white/20 hover:text-rose-200"><X className="h-3.5 w-3.5" /></button>}</div>)}<button type="button" onClick={() => addPlayer(i)} className="font-mono text-[8px] uppercase tracking-[.18em] text-cyan-200 hover:text-cyan-100">+ přidat hráče</button></div></div>)}</div><NicknamesDatalist options={nicknames} /></div>
          {err && <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[.05] px-4 py-3 text-sm text-rose-200">{err}</div>}
          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3.5 text-sm font-black text-black shadow-[0_0_36px_-15px_rgba(250,204,21,.9)] transition hover:bg-amber-200 disabled:opacity-50"><Sparkles className="h-4 w-4" />{busy ? "Generuji turnaj…" : "Vytvořit turnaj a otevřít soutěž"}</button>
        </form>
      </UltraSection>}

      <UltraSection title="VŠECHNY TURNAJE" kicker="COMPETITION INDEX" icon={<Trophy className="h-4 w-4 text-amber-200" />} className="mt-4">
        {list.length === 0 ? <StateBlock state="empty" title={user ? "Zatím žádné turnaje" : "Přihlas se pro přístup k turnajům"} hint="Jakmile bude založená první soutěž, zobrazí se v tomto indexu." /> : <div className="grid gap-3 lg:grid-cols-2">{list.map((t, i) => <article key={t.id} className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[.02] p-4 transition hover:-translate-y-0.5 hover:border-amber-300/25"><div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 via-cyan-300/50 to-transparent opacity-60" /><Link to="/tournament" search={{ id: t.id }} className="block pl-2"><div className="flex items-center justify-between gap-3"><span className="aaa-meta text-cyan-200/70">{SPORTS[t.sport]?.emoji} {SPORTS[t.sport]?.name ?? t.sport}</span><span className="font-mono text-[8px] uppercase tracking-[.16em] text-amber-200/60">#{String(i + 1).padStart(2, "0")}</span></div><div className="mt-2 truncate font-display text-2xl text-white">{t.name}</div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/8 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/30">{t.format === "round_robin" ? "KAŽDÝ S KAŽDÝM" : "VYŘAZOVACÍ"}</span>{t.scheduledAt && <TimeBadge>{new Date(t.scheduledAt).toLocaleString("cs-CZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TimeBadge>}</div></Link>{isAdmin && <button type="button" onClick={async () => { if (!confirm(`Smazat turnaj „${t.name}“ včetně jeho zápasů?`)) return; await deleteTournament(t.id); setList((prev) => prev.filter((x) => x.id !== t.id)); }} className="mt-4 ml-2 inline-flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2 font-mono text-[8px] uppercase tracking-[.16em] text-white/25 hover:border-rose-300/25 hover:text-rose-200"><X className="h-3.5 w-3.5" /> Smazat</button>}</article>)}</div>}
      </UltraSection>
    </UltraArenaShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[9px] font-black uppercase tracking-[.18em] text-white/35"><span>{label}</span><div className="mt-2">{children}</div></label>;
}
