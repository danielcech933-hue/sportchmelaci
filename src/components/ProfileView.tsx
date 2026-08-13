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
import { useWallet } from "@/lib/wallet";
import { ArcadeProfile } from "@/components/ArcadeProfile";
import { ProfileBettingLedger } from "@/components/ProfileBettingLedger";
import { splitPlayers, sideOf, winnerSideOf, playerSplitStats, isSoloMatch } from "@/lib/stats";
import { NeonStat } from "@/components/NeonStat";
import { playerEmoji, statEmoji } from "@/lib/emoji";

import heroImg from "@/assets/profile-hero.jpg";

type BetStatus = "won" | "lost" | "open";
type BetRow = Bet & { matchId: string; match: Match; status: BetStatus };

export { splitPlayers };

function playsInMatch(nickname: string, m: Match): boolean {
  return sideOf(nickname, m) !== null;
}

function matchOutcome(nickname: string | null, m: Match): "win" | "loss" | null {
  if (!nickname) return null;
  const w = winnerSideOf(m);
  if (!w) return null;
  const side = sideOf(nickname, m);
  if (!side) return null;
  return side === w ? "win" : "loss";
}

export function ProfileView({ userId }: { userId?: string }) {
  const { user, nickname: myNickname, avatarPath: myAvatar, refreshProfile, loading: authLoading } = useAuth();
  const { openChat } = useDm();
  const { userDollars, slotCZK } = useWallet();
  const targetId = userId ?? user?.id ?? null;
  const isSelf = !!targetId && targetId === user?.id;
  const [mode, setMode] = useState<"real" | "arcade">("real");
  const [profile, setProfile] = useState<{ nickname: string; avatar_path: string | null } | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    setProfileMissing(false);
    supabase.from("profiles").select("nickname,avatar_path").eq("id", targetId).maybeSingle().then(({ data }) => {
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
    return matches.filter((m) => playsInMatch(nickname, m)).sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
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

  const [ledgerNet, setLedgerNet] = useState(0);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  useEffect(() => {
    if (!isSelf) { setLedgerNet(0); setLedgerLoaded(false); return; }
    let active = true;
    setLedgerLoaded(false);
    supabase.rpc("get_my_betting_ledger", { _limit: 200 }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setLedgerLoaded(false); return; }
      const settledRows = (data ?? []).filter((row: any) => row.kind === "bet_payout" || row.kind === "bet_refund");
      const payoutNet = settledRows.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
      const settledMatchIds = new Set(
        settledRows
          .map((row: any) => row.match_id ?? row.metadata?.match_id)
          .filter(Boolean)
          .map(String),
      );

      // Net $ must use the same settlement window as the authoritative ledger.
      // This prevents old stakes from being subtracted when their payout/refund
      // is outside the 200-row ledger window.
      const settledStake = myBets.reduce((sum, bet) => {
        if (!settledMatchIds.has(String(bet.matchId))) return sum;
        return sum + (bet.status === "won" || bet.status === "lost" ? Number(bet.amount ?? 0) : 0);
      }, 0);

      const net = payoutNet - settledStake;
      setLedgerNet(Math.round(net * 100) / 100);
      setLedgerLoaded(true);
    });
    return () => { active = false; };
  }, [isSelf, targetId, myBets]);

  const stats = useMemo(() => {
    let betWon = 0, betLost = 0, betOpen = 0, biggestBet = 0;
    for (const b of myBets) {
      biggestBet = Math.max(biggestBet, b.amount ?? 0);
      if (b.status === "won") betWon++;
      else if (b.status === "lost") betLost++;
      else betOpen++;
    }
    const split = playerSplitStats(matches, nickname);
    const sports = new Set(myMatches.map((m) => m.sport));
    return {
      solo: split.solo,
      team: split.team,
      total: split.overall.total,
      victories: split.overall.wins,
      losses: split.overall.losses,
      betWon, betLost, betOpen,
      moneyNet: ledgerLoaded ? ledgerNet : 0,
      biggestBet, sports: sports.size,
    };
  }, [matches, myMatches, myBets, nickname, ledgerLoaded, ledgerNet]);

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
  if (!targetId) return <main className="mx-auto max-w-6xl px-4 py-10"><div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur"><div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" /><p className="relative text-muted-foreground"><Link to="/auth" className="text-primary hover:underline">Přihlas se</Link>, abys viděl svůj profil.</p></div></main>;
  if (profileMissing) return <main className="mx-auto max-w-6xl px-4 py-10"><div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur"><p className="relative text-muted-foreground">Tento hráč neexistuje.</p></div></main>;

  return (
    <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/30 bg-background/70 shadow-[0_30px_90px_-55px_var(--color-primary)] backdrop-blur-md">
        <img src={heroImg} alt="" width={1600} height={720} className="h-48 w-full object-cover opacity-55 sm:h-72" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/45 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-primary backdrop-blur">PLAYER // PROFILE</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-background/45 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {isSelf ? "Aktivní hráč" : "SportChmeláci"}</div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-4 sm:gap-6 sm:p-8">
          <div className={`shrink-0 rounded-full ring-2 ring-primary/40 ring-offset-4 ring-offset-background/20 ${heroFx}`}><Avatar path={avatarPath} nickname={nickname} size={104} /></div>
          <div className="min-w-0 pb-1"><div className="text-[10px] uppercase tracking-[0.3em] text-primary/80">{isSelf ? "Můj profil" : "Profil hráče"}</div><h1 className="mt-1 truncate font-display text-4xl tracking-wider neon-text sm:text-7xl"><span className="mr-2 align-middle text-2xl sm:text-4xl">{playerEmoji(nickname)}</span><span className="text-primary">{nickname ?? "PLAYER"}</span></h1><p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">Zápasy · výkon · betting activity</p></div>
        </div>
      </section>

      {isSelf && <section className="mt-4 grid grid-cols-2 gap-3 sm:max-w-xl"><div className="group rounded-2xl border border-accent/35 bg-gradient-to-br from-accent/10 to-background/55 p-4 shadow-[0_18px_50px_-38px_var(--color-accent)] transition-transform hover:-translate-y-0.5"><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Sportovní dolary</p><p className="mt-1 font-display text-2xl tracking-[0.08em] text-accent">${userDollars.toFixed(0)}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">Spendable balance</p></div><div className="group rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/10 to-background/55 p-4 shadow-[0_18px_50px_-38px_var(--color-primary)] transition-transform hover:-translate-y-0.5"><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Slot CZK</p><p className="mt-1 font-display text-2xl tracking-[0.08em] text-primary">{slotCZK.toLocaleString("cs-CZ")}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">Casino balance</p></div></section>}

      <section className="mt-5 flex justify-center"><div className="relative inline-flex rounded-full border border-primary/25 bg-background/65 p-1 shadow-[0_12px_35px_-25px_var(--color-primary)] backdrop-blur"><span aria-hidden className={`absolute inset-y-1 w-1/2 rounded-full bg-primary/10 shadow-[0_0_24px_-6px_var(--color-primary)] transition-transform duration-300 ease-out ${mode === "arcade" ? "translate-x-full" : "translate-x-0"}`} style={{ left: "0.25rem", right: "0.25rem", width: "calc(50% - 0.25rem)" }} />{(["real", "arcade"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors duration-300 sm:text-sm ${mode === m ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{m === "real" ? <Trophy className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}{m === "real" ? "Sport" : "Arcade"}</button>)}</div></section>

      {mode === "arcade" && targetId ? <ArcadeProfile userId={targetId} isSelf={isSelf} /> : <>{isSelf ? <AvatarSection userId={targetId} avatarPath={avatarPath} onChange={refreshProfile} /> : <section className="mt-6 grid gap-2 sm:grid-cols-3"><Link to="/schedule" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)] transition-transform hover:-translate-y-0.5"><Swords className="h-4 w-4" /> Vyzvat na zápas</Link><button onClick={() => targetId && openChat(targetId)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-background/45 px-4 py-3 text-sm font-semibold text-primary backdrop-blur hover:bg-primary/10"><MessageSquare className="h-4 w-4" /> Soukromá zpráva</button><Link to="/chat" search={{ to: nickname ?? undefined }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/35 px-4 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"><AtSign className="h-4 w-4" /> Zmínit v Lobby</Link></section>}

      <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><NeonStat label="Zápasy" value={stats.total} tone="cyan" emoji={statEmoji("matches")} hint="Odehrané rozhodnuté zápasy" /><NeonStat label="Výhry" value={stats.victories} tone="gold" emoji={statEmoji("wins")} /><NeonStat label="Prohry" value={stats.losses} tone="rose" emoji={statEmoji("losses")} /><NeonStat label="Sázky +" value={stats.betWon} tone="gold" emoji={statEmoji("bets")} /><NeonStat label="Sázky −" value={stats.betLost} tone="rose" emoji={statEmoji("bets")} /><NeonStat label="Net $" value={(stats.moneyNet >= 0 ? "+" : "") + stats.moneyNet.toFixed(0)} tone={stats.moneyNet >= 0 ? "violet" : "rose"} emoji={statEmoji("money")} /></section>
      {isSelf && <ProfileBettingLedger userId={targetId} />}
      <section className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-primary/15 bg-background/45 p-4 backdrop-blur transition-colors hover:border-primary/25"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg tracking-wider text-primary">SPORTOVNÍ STATISTIKY</h2><span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Performance</span></div><p className="mt-2 text-sm text-muted-foreground">Solo: <span className="font-mono text-foreground">{stats.solo.total}</span> ({stats.solo.wins}–{stats.solo.losses}) · Team: <span className="font-mono text-foreground">{stats.team.total}</span> ({stats.team.wins}–{stats.team.losses})</p></div><div className="rounded-2xl border border-primary/15 bg-background/45 p-4 backdrop-blur transition-colors hover:border-primary/25"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg tracking-wider text-primary">SÁZKY</h2><span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Activity</span></div><p className="mt-2 text-sm text-muted-foreground">Výhry: <span className="font-mono text-accent">{stats.betWon}</span> · Prohry: <span className="font-mono text-danger">{stats.betLost}</span> · Otevřené: <span className="font-mono text-foreground">{stats.betOpen}</span></p></div></section>
      </>}
    </main>
  );
}

function AvatarSection({ userId, avatarPath, onChange }: { userId: string; avatarPath: string | null; onChange: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => { setBusy(true); try { const ext = file.name.split(".").pop() || "jpg"; const path = `${userId}/avatar-${Date.now()}.${ext}`; const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type }); if (uploadError) throw uploadError; await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId); invalidateAvatar(avatarPath); onChange(); } finally { setBusy(false); } };
  return <section className="mt-4 flex items-center justify-between rounded-2xl border border-border/50 bg-background/35 p-3 backdrop-blur"><div><div className="text-xs font-medium text-foreground">Profilový avatar</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Personalizace profilu</div></div><><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} /><button disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"><Upload className="h-4 w-4" /> {busy ? "Nahrávám…" : "Změnit"}</button></></section>;
}
