import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, Trophy, X, Zap, Plus } from "lucide-react";
import { SPORTS, type SportId } from "@/lib/matches";
import { createMatch } from "@/lib/matches-db";
import { createTournament, type TournamentFormat } from "@/lib/tournaments-db";
import { NICKNAMES_DATALIST_ID, NicknamesDatalist, useNicknames } from "@/lib/nicknames";
import { useAuth } from "@/lib/auth";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const FORMATS: { id: TournamentFormat; label: string; hint: string }[] = [
  { id: "round_robin", label: "Každý s každým", hint: "Vygeneruje všechny dvojice" },
  { id: "single_elimination", label: "Pavouk", hint: "Vyřazovací s postupem vítězů" },
];

const inputCls =
  "w-full rounded-md border border-primary/30 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_20px_-8px_var(--color-primary)]";
const labelCls = "font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70";

export function SportActionModal({
  sport,
  image,
  onClose,
}: {
  sport: SportId;
  image?: string;
  onClose: () => void;
}) {
  const cfg = SPORTS[sport];
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const nicknames = useNicknames();
  const [tab, setTab] = useState<"match" | "tournament">("match");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 1v1
  const [playerA, setPlayerA] = useState(cfg.defaultTeams[0]);
  const [playerB, setPlayerB] = useState(cfg.defaultTeams[1]);
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
  });

  // tournament
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [teams, setTeams] = useState<string[]>(["", "", ""]);
  const [rosters, setRosters] = useState<string[][]>([[""], [""], [""]]);
  const [tWhen, setTWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return toLocalInput(d);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function setSize(n: number) {
    const size = Math.max(2, Math.min(32, n));
    setTeams((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? ""));
    setRosters((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? [""]));
  }

  async function submitMatch(e: React.FormEvent, live: boolean) {
    e.preventDefault();
    if (!user) { navigate({ to: "/auth" }); return; }
    setBusy(true); setErr(null);
    try {
      let scheduledAt: number | undefined;
      if (!live) {
        const ts = new Date(when).getTime();
        if (!ts || Number.isNaN(ts)) throw new Error("Vyber platný termín");
        scheduledAt = ts;
      }
      const id = await createMatch({
        ownerId: user.id,
        sport,
        teamA: playerA.trim() || cfg.defaultTeams[0],
        teamB: playerB.trim() || cfg.defaultTeams[1],
        ...(scheduledAt ? { scheduledAt } : {}),
      });
      onClose();
      navigate({ to: "/match", search: { id } });
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  async function submitTournament(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate({ to: "/auth" }); return; }
    const idx = teams.map((t, i) => [t.trim(), i] as const).filter(([t]) => t);
    const filled = idx.map(([t]) => t);
    if (filled.length < 2) { setErr("Zadej alespoň 2 týmy."); return; }
    if (new Set(filled).size !== filled.length) { setErr("Názvy týmů se nesmí opakovat."); return; }
    setBusy(true); setErr(null);
    try {
      const ts = tWhen ? new Date(tWhen).getTime() : NaN;
      const id = await createTournament({
        name: name.trim() || `${cfg.name} turnaj`,
        sport,
        format,
        teams: filled,
        players: idx.map(([, i]) => (rosters[i] ?? []).map((p) => p.trim()).filter(Boolean)),
        scheduledAt: Number.isNaN(ts) ? null : ts,
      });
      onClose();
      navigate({ to: "/tournament", search: { id } });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Nepodařilo se vytvořit turnaj";
      setErr(msg.includes("not_admin") ? "Turnaj může založit pouze admin." : msg);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Zavřít"
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${cfg.name} — naplánovat`}
        className="relative z-10 max-h-[92vh] w-full max-w-2xl animate-in slide-in-from-bottom-4 overflow-y-auto rounded-t-2xl border border-primary/40 bg-background shadow-[0_0_60px_-20px_var(--color-primary)] duration-300 sm:rounded-2xl"
      >
        <div className="relative">
          {image && (
            <img
              src={image}
              alt={cfg.name}
              className="h-48 w-full object-cover object-center saturate-125 contrast-110 sm:h-64"
            />
          )}
          <button
            onClick={onClose}
            aria-label="Zavřít"
            className="absolute right-3 top-3 rounded-full border border-primary/50 bg-background/70 p-2 text-primary backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-primary/20 bg-primary/5 px-4 py-3 sm:px-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">// {cfg.name}</p>
          <h2 className="font-display text-3xl tracking-widest neon-text sm:text-4xl">
            {cfg.emoji} {cfg.name.toUpperCase()}
          </h2>
        </div>


        <div className="px-4 pb-5 pt-4 sm:px-5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setTab("match"); setErr(null); }}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                tab === "match" ? "border-primary bg-primary/15 text-primary" : "border-primary/25 text-muted-foreground hover:border-primary/60"
              }`}
            >
              <CalendarClock className="h-4 w-4" /> Zápas 1v1
            </button>
            <button
              type="button"
              onClick={() => { setTab("tournament"); setErr(null); }}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                tab === "tournament" ? "border-accent bg-accent/15 text-accent" : "border-primary/25 text-muted-foreground hover:border-accent/60"
              }`}
            >
              <Trophy className="h-4 w-4" /> Turnaj
            </button>
          </div>

          {!user && (
            <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Pro vytvoření zápasu se musíš přihlásit.
            </p>
          )}

          {tab === "match" ? (
            <form onSubmit={(e) => submitMatch(e, false)} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Hráč / tým A</label>
                  <input list={NICKNAMES_DATALIST_ID} value={playerA} maxLength={60}
                    onChange={(e) => setPlayerA(e.target.value)} className={`mt-1.5 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Hráč / tým B</label>
                  <input list={NICKNAMES_DATALIST_ID} value={playerB} maxLength={60}
                    onChange={(e) => setPlayerB(e.target.value)} className={`mt-1.5 ${inputCls}`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Termín</label>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                  className={`mt-1.5 ${inputCls} font-mono text-primary`} />
              </div>
              {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" disabled={busy}
                  className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_var(--color-primary)] transition hover:brightness-110 disabled:opacity-50">
                  Naplánovat zápas
                </button>
                <button type="button" disabled={busy} onClick={(e) => submitMatch(e, true)}
                  className="flex items-center justify-center gap-2 rounded-md border border-primary/40 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50">
                  <Zap className="h-4 w-4" /> Začít hned
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitTournament} className="mt-4 space-y-4">
              {!isAdmin && user && (
                <p className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
                  Turnaj může založit pouze admin.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Název</label>
                  <input value={name} maxLength={60} placeholder={`${cfg.name} pohár`}
                    onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Počet týmů</label>
                  <input type="number" min={2} max={32} value={teams.length}
                    onChange={(e) => setSize(Number(e.target.value))} className={`mt-1.5 ${inputCls} font-mono`} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {FORMATS.map((f) => (
                  <button key={f.id} type="button" onClick={() => setFormat(f.id)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                      format === f.id ? "border-accent/60 bg-accent/15 text-accent" : "border-primary/20 text-muted-foreground hover:border-accent/50"
                    }`}>
                    <span className="block font-semibold">{f.label}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">{f.hint}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className={labelCls}>Plánovaný začátek</label>
                <input type="datetime-local" value={tWhen} onChange={(e) => setTWhen(e.target.value)}
                  className={`mt-1.5 ${inputCls} font-mono text-primary`} />
              </div>
              <div>
                <p className={labelCls}>Týmy a hráči</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {teams.map((t, i) => (
                    <div key={i} className="rounded-lg border border-primary/20 bg-background/40 p-3">
                      <input value={t} list={NICKNAMES_DATALIST_ID} placeholder={`Tým ${i + 1}`}
                        onChange={(e) => setTeams((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                        className={`${inputCls} font-display tracking-wide`} />
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Hráči</p>
                      <div className="mt-1 grid gap-1.5">
                        {(rosters[i] ?? [""]).map((p, j) => (
                          <div key={j} className="flex items-center gap-1.5">
                            <input value={p} list={NICKNAMES_DATALIST_ID} placeholder={`Hráč ${j + 1}`}
                              onChange={(e) => setRosters((prev) => prev.map((r, ri) => (ri === i ? r.map((v, rj) => (rj === j ? e.target.value : v)) : r)))}
                              className="w-full rounded-md border border-primary/20 bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/60" />
                            <button type="button" aria-label="Odebrat hráče"
                              onClick={() => setRosters((prev) => prev.map((r, ri) => (ri === i ? (r.length > 1 ? r.filter((_, rj) => rj !== j) : [""]) : r)))}
                              className="rounded border border-primary/25 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">×</button>
                          </div>
                        ))}
                      </div>
                      <button type="button"
                        onClick={() => setRosters((prev) => prev.map((r, ri) => (ri === i ? [...r, ""] : r)))}
                        className="mt-2 inline-flex items-center gap-1 rounded border border-primary/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:bg-primary/10">
                        <Plus className="h-3 w-3" /> hráče
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
              <button type="submit" disabled={busy || !isAdmin}
                className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-40">
                {busy ? "Generuji rozpis…" : "Vytvořit turnaj a rozpis"}
              </button>
            </form>
          )}
          <NicknamesDatalist options={nicknames} />
        </div>
      </div>
    </div>
  );
}
