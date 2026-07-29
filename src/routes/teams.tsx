import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchAllTeams,
  createTeam,
  deleteTeam,
  addMemberByNickname,
  removeMember,
  type Team,
} from "@/lib/teams-db";
import { useNicknames, NicknamesDatalist, NICKNAMES_DATALIST_ID } from "@/lib/nicknames";
import heroImg from "@/assets/teams-hero.jpg";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Courtside — Teams" },
      { name: "description", content: "Create teams from registered players and manage their rosters." },
      { property: "og:title", content: "Courtside — Teams" },
      { property: "og:description", content: "Create teams from registered players and manage their rosters." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { user, loading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try { setTeams(await fetchAllTeams()); } catch (e) { setErr((e as Error).message); }
  }

  useEffect(() => { if (user) reload(); }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted-foreground">Please <Link to="/auth" className="text-primary underline">sign in</Link> to manage teams.</p>
      </main>
    );
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await createTeam(user!.id, name.trim());
      setName("");
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className="relative mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-70 sm:h-60" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Roster grid
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-wider neon-text sm:text-6xl">TEAMS</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Build squads from registered nicknames</p>
        </div>
      </section>

      <form onSubmit={submitCreate} className="relative mt-6 flex flex-col gap-2 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-3 backdrop-blur sm:flex-row sm:p-4">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New team name"
          className="relative flex-1 rounded-md border border-primary/30 bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_-8px_var(--color-primary)]"
          maxLength={60}
        />
        <button disabled={busy} className="relative rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)] disabled:opacity-50">
          Create team
        </button>
      </form>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      <NicknamesList />

      <ul className="mt-6 space-y-3">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} currentUserId={user!.id} onChange={reload} />
        ))}
        {teams.length === 0 && (
          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-background/40 px-4 py-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <div className="relative font-display text-xl tracking-widest text-muted-foreground neon-text">NO SQUADS</div>
            <p className="relative mt-1 text-xs uppercase tracking-[0.25em] text-muted-foreground">Create your first team above</p>
          </div>
        )}
      </ul>
    </main>
  );
}

function NicknamesList() {
  const nicknames = useNicknames();
  return <NicknamesDatalist options={nicknames} />;
}

function TeamCard({ team, currentUserId, onChange }: { team: Team; currentUserId: string; onChange: () => void }) {
  const isOwner = team.ownerId === currentUserId;
  const [nick, setNick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nick.trim()) return;
    setBusy(true); setErr(null);
    try { await addMemberByNickname(team.id, nick.trim()); setNick(""); onChange(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <li className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-4 backdrop-blur transition hover:border-primary/60">
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl tracking-wider neon-text">{team.name}</h3>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            captain <span className="text-primary">{team.ownerNickname}</span> · {team.members.length} member{team.members.length === 1 ? "" : "s"}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={async () => { if (confirm(`Delete team "${team.name}"?`)) { await deleteTeam(team.id); onChange(); } }}
            className="rounded-md border border-primary/25 px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
          >Delete</button>
        )}
      </div>

      {team.members.length > 0 && (
        <ul className="relative mt-3 flex flex-wrap gap-2">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
              <span className="font-mono text-primary">{m.nickname}</span>
              {isOwner && (
                <button onClick={async () => { await removeMember(m.id); onChange(); }} className="text-muted-foreground hover:text-destructive">×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <form onSubmit={add} className="relative mt-3 flex gap-2">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            list={NICKNAMES_DATALIST_ID}
            placeholder="Add player by nickname"
            className="flex-1 rounded-md border border-primary/30 bg-background/40 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
          />
          <button disabled={busy} className="rounded-md bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Add</button>
        </form>
      )}
      {err && <p className="relative mt-2 text-xs text-destructive">{err}</p>}
    </li>
  );
}
