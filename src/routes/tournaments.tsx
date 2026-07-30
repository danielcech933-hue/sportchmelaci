import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SPORTS, SPORT_LIST, type SportId } from "@/lib/matches";
import { NICKNAMES_DATALIST_ID, NicknamesDatalist, useNicknames } from "@/lib/nicknames";
import {
  createTournament,
  deleteTournament,
  fetchTournaments,
  type Tournament,
  type TournamentFormat,
} from "@/lib/tournaments-db";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Turnaje — Chmeloví Sportovci" },
      { name: "description", content: "Turnaje ligy Chmeloví Sportovci: každý s každým i vyřazovací pavouk s automatickým rozpisem zápasů a sázkami." },
      { property: "og:title", content: "Turnaje — Chmeloví Sportovci" },
      { property: "og:description", content: "Přehled turnajů, rozpisy zápasů, tabulky a pavouci." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentsPage,
});

const FORMATS: { id: TournamentFormat; label: string; hint: string }[] = [
  { id: "round_robin", label: "Každý s každým", hint: "Vygeneruje všechny dvojice" },
  { id: "single_elimination", label: "Pavouk (vyřazovací)", hint: "Single elimination s postupem vítězů" },
];

function TournamentsPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const nicknames = useNicknames();
  const [list, setList] = useState<Tournament[]>([]);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<SportId>("tennis");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [count, setCount] = useState(3);
  const [teams, setTeams] = useState<string[]>(["", "", ""]);
  const [rosters, setRosters] = useState<string[][]>([[""], [""], [""]]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments().then(setList).catch(() => {});
  }, []);

  function setSize(n: number) {
    const size = Math.max(2, Math.min(32, n));
    setCount(size);
    setTeams((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? ""));
    setRosters((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? [""]));
  }

  function setPlayer(ti: number, pi: number, v: string) {
    setRosters((prev) => prev.map((r, i) => (i === ti ? r.map((p, j) => (j === pi ? v : p)) : r)));
  }
  function addPlayer(ti: number) {
    setRosters((prev) => prev.map((r, i) => (i === ti ? [...r, ""] : r)));
  }
  function removePlayer(ti: number, pi: number) {
    setRosters((prev) => prev.map((r, i) => (i === ti ? (r.length > 1 ? r.filter((_, j) => j !== pi) : [""]) : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const idx = teams.map((t, i) => [t.trim(), i] as const).filter(([t]) => t);
    const filled = idx.map(([t]) => t);
    if (filled.length < 2) { setErr("Zadej alespoň 2 týmy."); return; }
    if (new Set(filled).size !== filled.length) { setErr("Názvy týmů se nesmí opakovat."); return; }
    const players = idx.map(([, i]) => (rosters[i] ?? []).map((p) => p.trim()).filter(Boolean));
    setBusy(true); setErr(null);
    try {
      const id = await createTournament({ name: name.trim() || "Turnaj", sport, format, teams: filled, players });
      navigate({ to: "/tournament", search: { id } });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Nepodařilo se vytvořit turnaj";
      setErr(msg.includes("not_admin") ? "Turnaj může založit pouze admin." : msg);
    } finally { setBusy(false); }
  }

  if (loading) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/40 p-6 md:p-10">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="scanline pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// TOURNAMENT MODE</p>
          <h1 className="mt-2 font-display text-4xl tracking-widest neon-text md:text-6xl">🏆 TURNAJE</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Automatický rozpis zápasů, tabulka nebo pavouk. Na každý duel lze sázet — max $250, jedna sázka na hráče.
          </p>
        </div>
      </div>

      {isAdmin && (
        <section className="panel neon-border mt-6 p-5">
          <h2 className="font-display text-xl tracking-wider neon-text">Nový turnaj</h2>
          <form onSubmit={submit} className="mt-4 grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Název
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Chmelový pohár"
                  className="mt-1 w-full rounded-md border border-primary/25 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Sport
                <select value={sport} onChange={(e) => setSport(e.target.value as SportId)}
                  className="mt-1 w-full rounded-md border border-primary/25 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60">
                  {SPORT_LIST.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                </select>
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Počet týmů / hráčů
                <input type="number" min={2} max={32} value={count} onChange={(e) => setSize(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-primary/25 bg-background/60 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/60" />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                    format === f.id ? "border-primary/60 bg-primary/15 text-primary" : "border-primary/20 text-muted-foreground hover:border-primary/50"
                  }`}>
                  <span className="block font-semibold">{f.label}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">{f.hint}</span>
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Týmy / hráči</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {teams.map((t, i) => (
                  <input key={i} value={t} list={NICKNAMES_DATALIST_ID} placeholder={`Tým ${i + 1}`}
                    onChange={(e) => setTeams((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className="rounded-md border border-primary/25 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
                ))}
              </div>
              <NicknamesDatalist options={nicknames} />
            </div>

            {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
            <button type="submit" disabled={busy}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {busy ? "Generuji rozpis…" : "Vytvořit turnaj a vygenerovat zápasy"}
            </button>
          </form>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl tracking-wider neon-text">Přehled turnajů</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {user ? "Zatím žádné turnaje." : "Přihlas se pro zobrazení turnajů."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((t) => (
              <div key={t.id} className="panel neon-border p-4">
                <Link to="/tournament" search={{ id: t.id }} className="block transition hover:brightness-110">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    <span>{SPORTS[t.sport]?.emoji} {SPORTS[t.sport]?.name ?? t.sport}</span>
                    <span className="text-accent">{t.format === "round_robin" ? "ROUND ROBIN" : "PAVOUK"}</span>
                  </div>
                  <h3 className="mt-2 font-display text-2xl tracking-wide">{t.name}</h3>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("cs-CZ")}
                  </p>
                </Link>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Smazat turnaj "${t.name}" včetně jeho zápasů?`)) return;
                      await deleteTournament(t.id);
                      setList((prev) => prev.filter((x) => x.id !== t.id));
                    }}
                    className="mt-3 rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                    Smazat
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
