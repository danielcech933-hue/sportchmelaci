import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SPORTS, type Match, type Bet } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, invalidateAvatar } from "@/lib/avatars";
import { NickLink } from "@/lib/profile-links";
import { Upload, Trash2, Swords, MessageSquare, AtSign, Trophy, Flame, Target, Coins, Sparkles, Medal, Zap, Crown, Gamepad2 } from "lucide-react";
import { useDm } from "@/lib/dm";
import { ArcadeProfile } from "@/components/ArcadeProfile";


import heroImg from "@/assets/profile-hero.jpg";

type BetStatus = "won" | "lost" | "open";
type BetRow = Bet & { matchId: string; match: Match; status: BetStatus };

export function splitPlayers(name: string): string[] {
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

function matchOutcome(nickname: string | null, m: Match): "win" | "loss" | null {
  if (!nickname) return null;
  const w = winnerSideOf(m);
  if (!w) return null;
  const side = w === "a" ? m.teamA : m.teamB;
  const won = splitPlayers(side).some((p) => p.toLowerCase() === nickname.toLowerCase());
  return won ? "win" : "loss";
}

export function ProfileView({ userId }: { userId?: string }) {
  const { user, nickname: myNickname, avatarPath: myAvatar, refreshProfile, loading: authLoading } = useAuth();
  const { openChat } = useDm();
  const targetId = userId ?? user?.id ?? null;
  const [mode, setMode] = useState<"real" | "arcade">("real");


  const [profile, setProfile] = useState<{ nickname: string; avatar_path: string | null } | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    setProfileMissing(false);
    supabase
      .from("profiles")
      .select("nickname,avatar_path")
      .eq("id", targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as { nickname: string; avatar_path: string | null });
        else setProfileMissing(true);
      });
  }, [targetId, isSelf ? myNickname : null, isSelf ? myAvatar : null]);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    fetchAllMatches().then(setMatches).finally(() => setLoading(false));
  }, [targetId]);

  const nickname = isSelf ? (myNickname ?? profile?.nickname ?? null) : (profile?.nickname ?? null);
  const avatarPath = isSelf ? myAvatar : (profile?.avatar_path ?? null);

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
    let betWon = 0, betLost = 0, betOpen = 0, moneyNet = 0, biggestBet = 0;
    for (const b of myBets) {
      biggestBet = Math.max(biggestBet, b.amount ?? 0);
      if (b.status === "won") { betWon++; if (b.amount) moneyNet += b.amount; }
      else if (b.status === "lost") { betLost++; if (b.amount) moneyNet -= b.amount; }
      else betOpen++;
    }
    let victories = 0, losses = 0;
    for (const m of myMatches) {
      const o = matchOutcome(nickname, m);
      if (o === "win") victories++;
      else if (o === "loss") losses++;
    }
    const sports = new Set(myMatches.map((m) => m.sport));
    return { total: myMatches.length, victories, losses, betWon, betLost, betOpen, moneyNet, biggestBet, sports: sports.size };
  }, [myMatches, myBets, nickname]);

  const badges = useMemo(() => {
    const all = [
      { id: "first-win", label: "První výhra", desc: "Vyhraj svůj první zápas", icon: Trophy, earned: stats.victories >= 1 },
      { id: "hattrick", label: "Hattrick", desc: "3 vítězství", icon: Flame, earned: stats.victories >= 3 },
      { id: "champion", label: "Šampion", desc: "10 vítězství", icon: Crown, earned: stats.victories >= 10 },
      { id: "veteran", label: "Veterán", desc: "10 odehraných zápasů", icon: Medal, earned: stats.total >= 10 },
      { id: "multisport", label: "Multisportovec", desc: "3 různé sporty", icon: Sparkles, earned: stats.sports >= 3 },
      { id: "bettor", label: "Aktivní sázkař", desc: "5 sázek", icon: Target, earned: myBets.length >= 5 },
      { id: "highroller", label: "High Roller", desc: "Sázka 200 $ a víc", icon: Zap, earned: stats.biggestBet >= 200 },
      { id: "profit", label: "V zisku", desc: "Kladná bilance sázek", icon: Coins, earned: stats.moneyNet > 0 },
    ];
    return all;
  }, [stats, myBets.length]);

  const heroFx = useMemo(() => {
    const fx = ["avatar-fx-pulse", "avatar-fx-spin", "avatar-fx-glitch", "avatar-fx-float", "avatar-fx-hue"];
    return fx[Math.floor(Math.random() * fx.length)];
  }, [targetId]);

  if (authLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>;

  if (!targetId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          <p className="relative text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Přihlas se</Link>, abys viděl svůj profil.
          </p>
        </div>
      </main>
    );
  }

  if (profileMissing) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <p className="relative text-muted-foreground">Tento hráč neexistuje.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-60 sm:h-64" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            {isSelf ? "Můj profil" : "Profil hráče"}
          </div>
          <div className="mt-2 flex items-center gap-4 sm:gap-6">
            <div className={`shrink-0 rounded-full ${heroFx}`}>
              <Avatar path={avatarPath} nickname={nickname} size={96} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl tracking-wider neon-text sm:text-7xl">
                <span className="text-primary">{nickname ?? "PLAYER"}</span>
              </h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Zápasy & historie sázek</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 flex justify-center">
        <div className="relative inline-flex rounded-full border border-primary/30 bg-background/60 p-1 backdrop-blur">
          <span
            aria-hidden
            className={`absolute inset-y-1 w-1/2 rounded-full bg-primary/15 shadow-[0_0_20px_-6px_var(--color-primary)] transition-transform duration-300 ease-out ${
              mode === "arcade" ? "translate-x-full" : "translate-x-0"
            }`}
            style={{ left: "0.25rem", right: "0.25rem", width: "calc(50% - 0.25rem)" }}
          />
          {(["real", "arcade"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors duration-300 sm:text-sm ${
                mode === m ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "real" ? <Trophy className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}
              {m === "real" ? "Sport" : "Arcade"}
            </button>
          ))}
        </div>
      </section>

      {mode === "arcade" && targetId ? (
        <ArcadeProfile userId={targetId} isSelf={isSelf} />
      ) : (
      <>
      {isSelf ? (

        <AvatarSection userId={targetId} avatarPath={avatarPath} onChange={refreshProfile} />
      ) : (
        <section className="mt-6 grid gap-2 sm:grid-cols-3">
          <Link
            to="/schedule"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--color-primary)]"
          >
            <Swords className="h-4 w-4" /> Vyzvat na zápas
          </Link>
          <button
            onClick={() => targetId && openChat(targetId)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <MessageSquare className="h-4 w-4" /> Soukromá zpráva
          </button>
          <Link
            to="/chat"
            search={{ to: nickname ?? undefined }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 px-4 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <AtSign className="h-4 w-4" /> Zmínit v Lobby
          </Link>
        </section>

      )}

      <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Zápasy" value={stats.total} />
        <Stat label="Výhry" value={stats.victories} tone={stats.victories > 0 ? "good" : undefined} />
        <Stat label="Prohry" value={stats.losses} tone={stats.losses > 0 ? "bad" : undefined} />
        <Stat label="Sázky +" value={stats.betWon} tone={stats.betWon > 0 ? "good" : undefined} />
        <Stat label="Sázky −" value={stats.betLost} tone={stats.betLost > 0 ? "bad" : undefined} />
        <Stat label="Net $" value={(stats.moneyNet >= 0 ? "+" : "") + stats.moneyNet.toFixed(0)} tone={stats.moneyNet >= 0 ? "good" : "bad"} />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl tracking-[0.25em] text-primary/80 neon-text sm:text-2xl">ODZNAKY A ÚSPĚCHY</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <li
                key={b.id}
                title={b.desc}
                className={`relative overflow-hidden rounded-xl border p-3 text-center backdrop-blur transition ${
                  b.earned
                    ? "border-primary/50 bg-primary/10 shadow-[0_0_24px_-12px_var(--color-primary)]"
                    : "border-border/50 bg-background/40 opacity-45 grayscale"
                }`}
              >
                <Icon className={`mx-auto h-6 w-6 ${b.earned ? "text-primary" : "text-muted-foreground"}`} />
                <div className="mt-1.5 font-display text-xs tracking-wider">{b.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{b.desc}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-[0.25em] text-primary/80 neon-text sm:text-2xl">
          {isSelf ? "MOJE ZÁPASY" : "ZÁPASY HRÁČE"}
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Načítám…</p>
        ) : myMatches.length === 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <p className="relative text-sm text-muted-foreground">
              Zatím žádné zápasy. <Link to="/" className="text-primary hover:underline">Začni →</Link>
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myMatches.map((m) => {
              const cfg = SPORTS[m.sport];
              const setsA = m.sets.filter((s) => s.a > s.b).length;
              const setsB = m.sets.filter((s) => s.b > s.a).length;
              const outcome = matchOutcome(nickname, m);
              const accent =
                outcome === "win"
                  ? "border-accent/50 bg-accent/[0.06]"
                  : outcome === "loss"
                    ? "border-destructive/50 bg-destructive/[0.06]"
                    : "border-primary/25 bg-background/60";
              return (
                <li key={m.id} className={`relative overflow-hidden rounded-xl border p-3 backdrop-blur transition hover:border-primary/60 sm:p-4 ${accent}`}>
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span>{cfg.emoji} {cfg.name}</span>
                        <span>·</span>
                        <span className="hidden sm:inline">{new Date(m.startedAt).toLocaleString()}</span>
                        <span className="sm:hidden">{new Date(m.startedAt).toLocaleDateString()}</span>
                        {m.endedAt && <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">Final</span>}
                        {outcome && (
                          <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                            outcome === "win" ? "border-accent/50 bg-accent/10 text-accent" : "border-destructive/50 bg-destructive/10 text-destructive"
                          }`}>
                            {outcome === "win" ? "Výhra" : "Prohra"}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                        <span className="min-w-0 truncate text-sm sm:text-base"><TeamNames name={m.teamA} /></span>
                        <span className="led-digit text-xl sm:text-3xl">
                          {cfg.hasSets && m.sets.length > 0 ? `${setsA} : ${setsB}` : `${m.scoreA} : ${m.scoreB}`}
                        </span>
                        <span className="min-w-0 truncate text-right text-sm sm:text-base"><TeamNames name={m.teamB} /></span>
                      </div>
                    </div>
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="shrink-0 rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)]"
                    >
                      {m.ownerId === user?.id ? (m.endedAt ? "Detail" : "Pokračovat") : "Detail"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-[0.25em] text-primary/80 neon-text sm:text-2xl">
          {isSelf ? "MOJE SÁZKY" : "SÁZKY HRÁČE"}
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Načítám…</p>
        ) : myBets.length === 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <p className="relative text-sm text-muted-foreground">Zatím žádné sázky.</p>
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
              const accent =
                b.status === "won"
                  ? "border-accent/50 bg-accent/[0.06]"
                  : b.status === "lost"
                    ? "border-destructive/50 bg-destructive/[0.06]"
                    : "border-primary/25 bg-background/60";
              return (
                <li key={b.id} className={`relative overflow-hidden rounded-xl border p-3 backdrop-blur transition hover:border-primary/60 sm:p-4 ${accent}`}>
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span className="truncate">{cfg.emoji} {m.teamA} vs {m.teamB}</span>
                        <span>·</span>
                        <span>{new Date(b.createdAt ?? m.startedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span>Tip <span className="font-semibold text-primary">{pickTeam}</span></span>
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
                        Zápas
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </>
      )}
    </main>

  );
}

function TeamNames({ name }: { name: string }) {
  const players = splitPlayers(name);
  return (
    <>
      {players.map((p, i) => (
        <span key={`${p}-${i}`}>
          {i > 0 && <span className="text-muted-foreground"> & </span>}
          <NickLink nickname={p} />
        </span>
      ))}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-accent" : tone === "bad" ? "text-destructive" : "text-primary";
  return (
    <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-background/60 p-2 backdrop-blur sm:p-3">
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
      <div className="relative text-[9px] uppercase tracking-[0.2em] text-primary/70">{label}</div>
      <div className={`relative mt-0.5 font-display text-xl neon-text sm:text-2xl ${color}`}>{value}</div>
    </div>
  );
}

function AvatarSection({
  userId,
  avatarPath,
  onChange,
}: {
  userId: string;
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
      setError("Pouze PNG, JPEG nebo WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Max velikost 20 MB.");
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
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
      if (dbErr) throw dbErr;
      if (avatarPath && avatarPath !== path) {
        await supabase.storage.from("avatars").remove([avatarPath]);
        invalidateAvatar(avatarPath);
      }
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nahrání selhalo");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!avatarPath) return;
    setBusy(true); setError(null);
    try {
      await supabase.storage.from("avatars").remove([avatarPath]);
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
      if (dbErr) throw dbErr;
      invalidateAvatar(avatarPath);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odebrání selhalo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-5">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// Avatar</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG nebo WebP · max 20 MB. Vidí ho ostatní v chatu i v žebříčku.</p>
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
            {avatarPath ? "Vyměnit" : "Nahrát"}
          </button>
          {avatarPath && (
            <button
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-2 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Odebrat
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
