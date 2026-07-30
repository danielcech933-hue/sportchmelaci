import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface AppNotification {
  id: string;
  tournamentId: string | null;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    if (!user) { setItems([]); return; }
    const { data } = await supabase
      .from("notifications")
      .select("id,tournament_id,kind,title,body,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(
      (data ?? []).map((n) => ({
        id: n.id,
        tournamentId: n.tournament_id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
    );
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    const t = setInterval(load, 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [user, load]);

  const markAllRead = useCallback(async () => {
    const unread = items.filter((i) => !i.readAt).map((i) => i.id);
    if (!unread.length) return;
    setItems((prev) => prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
  }, [items]);

  return { items, unread: items.filter((i) => !i.readAt).length, reload: load, markAllRead };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function NotificationsBell() {
  const { user } = useAuth();
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        aria-label="Notifikace"
        onClick={() => { setOpen((o) => !o); if (!open) markAllRead(); }}
        className="relative rounded-md border border-primary/25 p-1.5 text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-background shadow-[0_0_10px_-2px_var(--color-accent)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,85vw)] overflow-hidden rounded-md border border-primary/30 bg-background/95 shadow-[0_0_30px_-10px_var(--color-primary)] backdrop-blur">
          <div className="border-b border-primary/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
            Notifikace
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">Zatím žádné notifikace.</p>
            )}
            {items.map((n) => {
              const inner = (
                <>
                  <p className="text-xs font-semibold text-foreground">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    {formatTime(n.createdAt)}
                  </p>
                </>
              );
              return n.tournamentId ? (
                <Link
                  key={n.id}
                  to="/tournament"
                  search={{ id: n.tournamentId }}
                  onClick={() => setOpen(false)}
                  className="block border-b border-primary/10 px-3 py-2 transition hover:bg-primary/5"
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-primary/10 px-3 py-2">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
