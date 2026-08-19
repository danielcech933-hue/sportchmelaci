import { useCallback, useEffect, useState } from "react";
import { Check, Shield, Swords, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  MATCH_MODES,
  cardsErrorMessage,
  createChallenge,
  fetchChallenges,
  fetchSquad,
  respondChallenge,
  setReady,
} from "@/lib/cards";
import type { ChallengeRow } from "@/types/cards";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Otevřená výzva",
  pending: "Čeká na přijetí",
  accepted: "Přijato",
  declined: "Odmítnuto",
  ready: "Připraveno k zápasu",
};

/** Lobby online výzev s Fair Play stropem na Team OVR. */
export function OnlineMatchLobby({ userId }: Props) {
  const [players, setPlayers] = useState<{ id: string; nickname: string }[]>([]);
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [mode, setMode] = useState("gold");
  const [opponent, setOpponent] = useState("");
  const [myOvr, setMyOvr] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [ch, sq] = await Promise.all([
      fetchChallenges().catch(() => [] as ChallengeRow[]),
      fetchSquad(userId).catch(() => null),
    ]);
    setRows(ch);
    setMyOvr(sq?.teamOvr ?? null);
  }, [userId]);

  useEffect(() => {
    reload();
    supabase
      .from("profile_public")
      .select("id,nickname")
      .neq("id", userId)
      .order("nickname")
      .then(({ data }) => setPlayers((data ?? []) as { id: string; nickname: string }[]));
  }, [reload, userId]);

  const nick = (id: string | null) => (id ? players.find((p) => p.id === id)?.nickname ?? (id === userId ? "Ty" : "Hráč") : "—");

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    setStatus(null);
    try {
      await fn();
      setStatus(ok);
      await reload();
    } catch (e) {
      setError(cardsErrorMessage(e));
    }
  }

  const cap = MATCH_MODES.find((m) => m.key === mode)?.cap ?? null;
  const mine = rows.filter((r) => r.hostId === userId || r.opponentId === userId);
  const open = rows.filter((r) => r.status === "open" && r.hostId !== userId);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur">
        <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
          <Swords className="h-3.5 w-3.5" /> Nová výzva
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded-md border border-border/60 bg-background/70 px-2 py-2 text-sm outline-none focus:border-primary/60"
          >
            {MATCH_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}{m.cap ? ` — max ${m.cap} OVR` : ""}
              </option>
            ))}
          </select>
          <select
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            className="rounded-md border border-border/60 bg-background/70 px-2 py-2 text-sm outline-none focus:border-primary/60"
          >
            <option value="">Otevřená výzva (kdokoli)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.nickname}</option>
            ))}
          </select>
          <button
            onClick={() => run(() => createChallenge(opponent || null, mode, cap), "Výzva vytvořena.")}
            className="rounded-full border border-primary/50 bg-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"
          >
            Vytvořit výzvu
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Shield className="mr-1 inline h-3 w-3" /> Fair play: tvoje sestava musí splnit strop ratingu.
          Aktuální Team OVR: <span className="font-mono text-primary">{myOvr ?? "—"}</span>
        </p>
        {status && <p className="mt-2 text-xs text-accent">{status}</p>}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>

      <Section title="Moje výzvy" empty="Žádné výzvy.">
        {mine.map((r) => {
          const isHost = r.hostId === userId;
          const ready = isHost ? r.hostReady : r.opponentReady;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/50 p-3">
              <span className="font-mono text-xs text-primary">
                {nick(r.hostId)} vs {r.opponentId ? nick(r.opponentId) : "kdokoli"}
              </span>
              <span className="rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                {MATCH_MODES.find((m) => m.key === r.mode)?.label ?? r.mode}
                {r.ovrCap ? ` · ≤${r.ovrCap}` : ""}
              </span>
              <span className={cn("font-mono text-[10px] uppercase tracking-widest", r.status === "ready" ? "text-emerald-300" : r.status === "declined" ? "text-danger" : "text-hop-gold")}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
              <span className="ml-auto flex gap-2">
                {!isHost && r.status === "pending" && (
                  <>
                    <button onClick={() => run(() => respondChallenge(r.id, true), "Přijato.")} className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                      <Check className="mr-1 inline h-3 w-3" />Přijmout
                    </button>
                    <button onClick={() => run(() => respondChallenge(r.id, false), "Odmítnuto.")} className="rounded-full border border-danger/50 bg-danger/10 px-3 py-1 text-[11px] text-danger">
                      <X className="mr-1 inline h-3 w-3" />Odmítnout
                    </button>
                  </>
                )}
                {(r.status === "accepted" || r.status === "ready") && (
                  <button
                    onClick={() => run(() => setReady(r.id, !ready), ready ? "Připravenost zrušena." : "Připraven!")}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em]",
                      ready ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : "border-primary/50 bg-primary/15 text-primary",
                    )}
                  >
                    {ready ? "Připraven ✓" : "Připraven k zápasu"}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </Section>

      <Section title="Otevřené výzvy" empty="Nikdo teď nehledá soupeře.">
        {open.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/50 p-3">
            <span className="font-mono text-xs text-primary">{nick(r.hostId)}</span>
            <span className="rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {MATCH_MODES.find((m) => m.key === r.mode)?.label ?? r.mode}
              {r.ovrCap ? ` · ≤${r.ovrCap}` : ""}
            </span>
            <button
              onClick={() => run(() => respondChallenge(r.id, true), "Výzva přijata.")}
              className="ml-auto rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-[11px] text-primary"
            >
              Přijmout výzvu
            </button>
          </li>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// {title}</p>
      {has ? <ul className="mt-2 space-y-2">{children}</ul> : <p className="mt-2 text-xs text-muted-foreground">{empty}</p>}
    </div>
  );
}

export default OnlineMatchLobby;
