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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl">Teams</h1>
      <p className="mt-1 text-sm text-muted-foreground">Build squads from registered nicknames.</p>

      <form onSubmit={submitCreate} className="panel mt-6 flex gap-2 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New team name"
          className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          maxLength={60}
        />
        <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          Create team
        </button>
      </form>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      <NicknamesList />

      <ul className="mt-6 space-y-3">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} currentUserId={user!.id} onChange={reload} />
        ))}
        {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams yet.</p>}
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
    <li className="panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl tracking-wider">{team.name}</h3>
          <p className="text-xs text-muted-foreground">
            captain <span className="text-primary">{team.ownerNickname}</span> · {team.members.length} member{team.members.length === 1 ? "" : "s"}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={async () => { if (confirm(`Delete team "${team.name}"?`)) { await deleteTeam(team.id); onChange(); } }}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >Delete</button>
        )}
      </div>

      {team.members.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs">
              <span className="font-mono text-primary">{m.nickname}</span>
              {isOwner && (
                <button onClick={async () => { await removeMember(m.id); onChange(); }} className="text-muted-foreground hover:text-destructive">×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="Add player by nickname"
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs"
          />
          <button disabled={busy} className="rounded-md bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Add</button>
        </form>
      )}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </li>
  );
}
