import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on public.matches.
 * When `matchId` is provided, only that row is watched.
 */
export function useMatchesRealtime(
  onChange: () => void,
  opts: { matchId?: string; tournamentId?: string; enabled?: boolean } = {},
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const { matchId, tournamentId, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    const key = matchId ?? tournamentId ?? "all";
    const channel = supabase
      .channel(`live-matches-${key}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          ...(matchId ? { filter: `id=eq.${matchId}` } : {}),
          ...(!matchId && tournamentId ? { filter: `tournament_id=eq.${tournamentId}` } : {}),
        },
        () => cb.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, tournamentId, enabled]);
}

export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-danger/50 bg-danger/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] ${className}`}
      style={{ color: "var(--danger)", borderColor: "color-mix(in oklab, var(--danger) 50%, transparent)" }}
    >
      <span
        className="inline-block h-1.5 w-1.5 animate-ping rounded-full"
        style={{ background: "var(--danger)" }}
      />
      LIVE
    </span>
  );
}
