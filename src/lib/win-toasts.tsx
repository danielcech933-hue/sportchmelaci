import { useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface WinToast {
  id: string;
  title: string;
  when: string;
  prize: string;
}

const WIN_KINDS = ["match_win", "bet_win", "arcade_win"];

function parseBody(body: string | null): { when: string; prize: string } {
  const parts = (body ?? "").split("•").map((s) => s.trim()).filter(Boolean);
  const when = parts[0] ?? new Date().toLocaleString("cs-CZ");
  const prize = parts.slice(1).join(" · ") || "Výhra";
  return { when, prize };
}

/** Celebratory in-app pop-ups — wins only, never losses. */
export function WinCelebrations() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<WinToast[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setToasts([]); return; }
    const ch = supabase
      .channel(`win-celebrations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; kind: string; title: string; body: string | null };
          if (!WIN_KINDS.includes(row.kind)) return;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);
          const { when, prize } = parseBody(row.body);
          setToasts((prev) => [...prev, { id: row.id, title: row.title, when, prize }].slice(-3));
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== row.id));
          }, 12_000);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="win-pop pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/60 bg-background/95 p-4 shadow-[0_0_50px_-10px_var(--color-primary)] backdrop-blur"
        >
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className={`confetti confetti-${i % 5}`} style={{ left: `${8 + i * 9}%`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Zavřít"
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="relative flex items-start gap-3">
            <PartyPopper className="mt-0.5 h-6 w-6 shrink-0 animate-bounce text-primary" />
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight tracking-wider text-primary neon-text">{t.title}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{t.when}</p>
              <p className="mt-1.5 inline-flex rounded-md border border-accent/50 bg-accent/10 px-2 py-1 font-mono text-xs font-bold text-accent">
                {t.prize}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
