import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SPORTS, type Match, type Bet } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, invalidateAvatar } from "@/lib/avatars";
import { Upload, Trash2 } from "lucide-react";
import heroImg from "@/assets/profile-hero.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — Courtside" },
      { name: "description", content: "Your matches and betting history under your nickname." },
      { property: "og:title", content: "Your Profile — Courtside" },
      { property: "og:description", content: "Your matches and betting history." },
    ],
  }),
  component: Profile,
});

type BetStatus = "won" | "lost" | "open";
type BetRow = Bet & { matchId: string; match: Match; status: BetStatus };

function splitPlayers(name: string): string[] {
  return name
    .split(/\s*(?:&|\/|\+|,|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function winnerSideOf(m: Match): "a" | "b" | null {
  if (!m.endedAt) return null;
  const cfg = SPORTS[m.sport];
  if (cfg.hasSets && m.sets.length > 0) {
    const a = m.sets.filter((s) => s.a > s.b).length;
    const b = m.sets.filter((s) => s.b > s.a).length;
    if (a === b) return null;
    return a > b ? "a" : "b";
  }
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "a" : "b";
}

function playsInMatch(nickname: string, m: Match): boolean {
  const nick = nickname.toLowerCase();
  const inSide = (name: string) => splitPlayers(name).some((p) => p.toLowerCase() === nick);
  return inSide(m.teamA) || inSide(m.teamB);
}

function Profile() {
  const { user, nickname, avatarPath, refreshProfile, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAllMatches()
      .then(setMatches)
      .finally(() => setLoading(false));
  }, [user]);

  const myMatches = useMemo(() => {
    if (!nickname) return [];
    return matches
      .filter((m) => playsInMatch(nickname, m))
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
  }, [matches, nickname]);

  const myBets: BetRow[] = useMemo(() => {
    if (!nickname) return [];
    const rows: BetRow[] = [];
    for (const m of matches) {
      const w = winnerSideOf(m);
      for (const b of m.bets ?? []) {
        if (b.bettor?.toLowerCase() === nickname.toLowerCase()) {
          const status: BetStatus = w ? (b.pick === w ? "won" : "lost") : "open";
          rows.push({ ...b, matchId: m.id, match: m, status });
        }
      }
    }
    return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [matches, nickname]);

  const stats = useMemo(() => {
    let betWon = 0, betLost = 0, betOpen = 0, moneyNet = 0;
    for (const b of myBets) {
      if (b.status === "won") { betWon++; if (b.amount) moneyNet += b.amount; }
      else if (b.status === "lost") { betLost++; if (b.amount) moneyNet -= b.amount; }
      else betOpen++;
    }
    const victories = nickname
      ? myMatches.filter((m) => {
          const w = winnerSideOf(m);
          if (!w) return false;
          const winnerSide = w === "a" ? m.teamA : m.teamB;
          return splitPlayers(winnerSide).some((p) => p.toLowerCase() === nickname.toLowerCase());
        }).length
      : 0;
    return { total: myMatches.length, victories, betWon, betLost, betOpen, moneyNet };
  }, [myMatches, myBets, nickname]);

  if (authLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          <p className="relative text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your profile.
          </p>
        </div>
      </main>
    );
  }

  const heroFx = useMemo(() => {
    const fx = ["avatar-fx-pulse", "avatar-fx-spin", "avatar-fx-glitch", "avatar-fx-float", "avatar-fx-hue"];
    return fx[Math.floor(Math.random() * fx.length)];
  }, [user?.id]);

  return (
    <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-60 sm:h-64" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Player profile
          </div>
          <div className="mt-2 flex items-center gap-4 sm:gap-6">
            <div className={`shrink-0 rounded-full ${heroFx}`}>
              <Avatar path={avatarPath} nickname={nickname} size={96} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl tracking-wider neon-text sm:text-7xl">
                <span className="text-primary">{nickname ?? "PLAYER"}</span>
              </h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Matches & betting history</p>
            </div>
          </div>
        </div>
      </section>

      <AvatarSection userId={user.id} nickname={nickname} avatarPath={avatarPath} onChange={refreshProfile} />

      <section className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5">
        <Stat label="Matches" value={stats.total} />
        <Stat label="Victories" value={stats.victories} tone={stats.victories > 0 ? "good" : undefined} />
        <Stat label="Bets won" value={stats.betWon} />
        <Stat label="Bets lost" value={stats.betLost} />
        <Stat label="Net $" value={(stats.moneyNet >= 0 ? "+" : "") + stats.moneyNet.toFixed(0)} tone={stats.moneyNet >= 0 ? "good" : "bad"} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-[0.25em] text-primary/80 neon-text">MY MATCHES</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : myMatches.length === 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <p className="relative text-sm text-muted-foreground">
              No matches yet. <Link to="/" className="text-primary hover:underline">Start one →</Link>
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myMatches.map((m) => {
              const cfg = SPORTS[m.sport];
              const setsA = m.sets.filter((s) => s.a > s.b).length;
              const setsB = m.sets.filter((s) => s.b > s.a).length;
              return (
                <li key={m.id} className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-3 backdrop-blur transition hover:border-primary/60 sm:p-4">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span>{cfg.emoji} {cfg.name}</span>
                        <span>·</span>
                        <span className="hidden sm:inline">{new Date(m.startedAt).toLocaleString()}</span>
                        <span className="sm:hidden">{new Date(m.startedAt).toLocaleDateString()}</span>
                        {m.endedAt && <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">Final</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                        <span className="min-w-0 truncate text-sm sm:text-base">{m.teamA}</span>
                        <span className="led-digit text-xl sm:text-3xl">
                          {cfg.hasSets && m.sets.length > 0 ? `${setsA} : ${setsB}` : `${m.scoreA} : ${m.scoreB}`}
                        </span>
                        <span className="min-w-0 truncate text-right text-sm sm:text-base">{m.teamB}</span>
                      </div>
                    </div>
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="shrink-0 rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)]"
                    >
                      {m.ownerId === user?.id ? (m.endedAt ? "View" : "Resume") : "View"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-[0.25em] text-primary/80 neon-text">MY BETS</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : myBets.length === 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <p className="relative text-sm text-muted-foreground">You haven't placed any bets yet.</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myBets.map((b) => {
              const m = b.match;
              const cfg = SPORTS[m.sport];
              const pickTeam = b.pick === "a" ? m.teamA : m.teamB;
              const tone =
                b.status === "won" ? "text-accent border-accent/40 bg-accent/10" :
                b.status === "lost" ? "text-destructive border-destructive/40 bg-destructive/10" :
                "text-muted-foreground border-primary/25 bg-background/40";
              return (
                <li key={b.id} className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-3 backdrop-blur transition hover:border-primary/60 sm:p-4">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span className="truncate">{cfg.emoji} {m.teamA} vs {m.teamB}</span>
                        <span>·</span>
                        <span>{new Date(b.createdAt ?? m.startedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span>Picked <span className="text-primary font-semibold">{pickTeam}</span></span>
                        {b.amount ? <span>· ${b.amount}</span> : null}
                        {b.note ? <span className="text-muted-foreground">· "{b.note}"</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${tone}`}>{b.status}</span>
                      <Link
                        to="/match"
                        search={{ id: m.id }}
                        className="rounded-md border border-primary/25 px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                      >
                        Match
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-accent" : tone === "bad" ? "text-destructive" : "text-primary";
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-4 backdrop-blur">
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
      <div className="relative text-[10px] uppercase tracking-[0.3em] text-primary/70">{label}</div>
      <div className={`relative mt-1 font-display text-3xl neon-text ${color}`}>{value}</div>
    </div>
  );
}

function AvatarSection({
  userId,
  nickname,
  avatarPath,
  onChange,
}: {
  userId: string;
  nickname: string | null;
  avatarPath: string | null;
  onChange: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG or WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Max size 20 MB.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      if (avatarPath && avatarPath !== path) {
        await supabase.storage.from("avatars").remove([avatarPath]);
        invalidateAvatar(avatarPath);
      }
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!avatarPath) return;
    setBusy(true); setError(null);
    try {
      await supabase.storage.from("avatars").remove([avatarPath]);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_path: null })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      invalidateAvatar(avatarPath);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-5">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
      <div className="relative flex flex-wrap items-center gap-4">
        <Avatar path={avatarPath} nickname={nickname} size={72} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// Avatar</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG or WebP · max 2 MB. Visible on your profile and in chat.</p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPick} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_20px_-6px_var(--color-primary)] disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {avatarPath ? "Replace" : "Upload"}
          </button>
          {avatarPath && (
            <button
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-2 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
