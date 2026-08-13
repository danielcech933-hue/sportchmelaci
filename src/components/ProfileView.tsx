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
      const net = (data ?? []).reduce((sum: number, row: any) => {
        const amount = Number(row.amount ?? 0);
        return sum + (row.kind === "bet_payout" || row.kind === "bet_refund" ? amount : 0);
      }, 0);
      setLedgerNet(Math.round(net * 100) / 100);
      setLedgerLoaded(true);
    });
    return () => { active = false; };
  }, [isSelf, targetId]);

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
      // Net $ is intentionally sourced from the authoritative betting ledger.
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
      <section className="relative overflow-hidden rounded-2xl neon-border scanline"><img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-60 sm:h-64" /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" /><div className="pointer-events-none absolute inset-0 grid-bg opacity-25" /><div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8"><div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs"><span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />{isSelf ? "Můj profil" : "Profil hráče"}</div><div className="mt-2 flex items-center gap-4 sm:gap-6"><div className={`shrink-0 rounded-full ${heroFx}`}><Avatar path={avatarPath} nickname={nickname} size={96} /></div><div className="min-w-0"><h1 className="truncate font-display text-3xl tracking-wider neon-text sm:text-7xl"><span className="mr-2 align-middle text-2xl sm:text-4xl">{playerEmoji(nickname)}</span><span className="text-primary">{nickname ?? "PLAYER"}</span></h1><p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Zápasy & historie sázek</p></div></div></div></section>
      {isSelf && <section className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md"><div className="rounded-xl border border-accent/40 bg-accent/10 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Sportovní dolary</p><p className="mt-0.5 font-display text-xl tracking-[0.08em] text-accent">${userDollars.toFixed(0)}</p></div><div className="rounded-xl border border-primary/40 bg-primary/10 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Slot CZK</p><p className="mt-0.5 font-display text-xl tracking-[0.08em] text-primary">{slotCZK.toLocaleString("cs-CZ")}</p></div></section>}
      <section className="mt-5 flex justify-center"><div className="relative inline-flex rounded-full border border-primary/30 bg-background/60 p-1 backdrop-blur"><span aria-hidden className={`absolute inset-y-1 w-1/2 rounded-full bg-primary/15 shadow-[0_0_20px_-6px_var(--color-primary)] transition-transform duration-300 ease-out ${mode === "arcade" ? "translate-x-full" : "translate-x-0"}`} style={{ left: "0.25rem", right: "0.25rem", width: "calc(50% - 0.25rem)" }} />{(["real", "arcade"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors duration-300 sm:text-sm ${mode === m ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{m === "real" ? <Trophy className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}{m === "real" ? "Sport" : "Arcade"}</button>)}</div></section>
      {mode === "arcade" && targetId ? <ArcadeProfile userId={targetId} isSelf={isSelf} /> : <>{isSelf ? <AvatarSection userId={targetId} avatarPath={avatarPath} onChange={refreshProfile} /> : <section className="mt-6 grid gap-2 sm:grid-cols-3"><Link to="/schedule" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--color-primary)]"><Swords className="h-4 w-4" /> Vyzvat na zápas</Link><button onClick={() => targetId && openChat(targetId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10"><MessageSquare className="h-4 w-4" /> Soukromá zpráva</button><Link to="/chat" search={{ to: nickname ?? undefined }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 px-4 py-3 text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"><AtSign className="h-4 w-4" /> Zmínit v Lobby</Link></section>}
      <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6"><NeonStat label="Zápasy" value={stats.total} tone="cyan" emoji={statEmoji("matches")} hint="Odehrané rozhodnuté zápasy" /><NeonStat label="Výhry" value={stats.victories} tone="gold" emoji={statEmoji("wins")} /><NeonStat label="Prohry" value={stats.losses} tone="rose" emoji={statEmoji("losses")} /><NeonStat label="Sázky +" value={stats.betWon} tone="gold" emoji={statEmoji("bets")} /><NeonStat label="Sázky −" value={stats.betLost} tone="rose" emoji={statEmoji("bets")} /><NeonStat label="Net $" value={(stats.moneyNet >= 0 ? "+" : "") + stats.moneyNet.toFixed(0)} tone={stats.moneyNet >= 0 ? "violet" : "rose"} emoji={statEmoji("money")} /></section>
      {isSelf && <ProfileBettingLedger userId={targetId} />}
      <section className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-primary/20 bg-background/50 p-4"><h2 className="font-display text-lg tracking-wider text-primary">SPORTOVNÍ STATISTIKY</h2><p className="mt-2 text-sm text-muted-foreground">Solo: {stats.solo.total} ({stats.solo.wins}–{stats.solo.losses}) · Team: {stats.team.total} ({stats.team.wins}–{stats.team.losses})</p></div><div className="rounded-2xl border border-primary/20 bg-background/50 p-4"><h2 className="font-display text-lg tracking-wider text-primary">SÁZKY</h2><p className="mt-2 text-sm text-muted-foreground">Výhry: {stats.betWon} · Prohry: {stats.betLost} · Otevřené: {stats.betOpen}</p></div></section>
      </>}
    </main>
  );
}

function AvatarSection({ userId, avatarPath, onChange }: { userId: string; avatarPath: string | null; onChange: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => { setBusy(true); try { const ext = file.name.split(".").pop() || "jpg"; const path = `${userId}/avatar-${Date.now()}.${ext}`; const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type }); if (uploadError) throw uploadError; await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId); invalidateAvatar(avatarPath); onChange(); } finally { setBusy(false); } };
  return <section className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-3"><div className="text-xs text-muted-foreground">Profilový avatar</div><><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} /><button disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-xs text-primary hover:bg-primary/10"><Upload className="h-4 w-4" /> {busy ? "Nahrávám…" : "Změnit"}</button></></section>;
}
