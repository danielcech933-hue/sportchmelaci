import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
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
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.readAt ? i : { ...i, readAt: now })));
    await supabase.from("notifications").update({ read_at: now }).in("id", unread);
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!user) return null;

  const panel = open && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifikace"
          className="fixed right-3 top-[4.4rem] z-[120] w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-primary/30 bg-background/95 shadow-[0_0_35px_-10px_var(--color-primary)] backdrop-blur-xl sm:right-4"
        >
          <div className="flex items-center justify-between border-b border-primary/20 px-3 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">Notifikace</span>
            {unread > 0 && <span className="font-mono text-[9px] uppercase tracking-widest text-accent">{unread} nové</span>}
          </div>
          <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
            {items.length === 0 && <p className="px-3 py-5 text-xs text-muted-foreground">Zatím žádné notifikace.</p>}
            {items.map((n) => {
              const inner = (
                <>
                  <p className="text-xs font-semibold text-foreground">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">{formatTime(n.createdAt)}</p>
                </>
              );
              return n.tournamentId ? (
                <Link key={n.id} to="/tournament" search={{ id: n.tournamentId }} onClick={() => setOpen(false)} className={`block border-b border-primary/10 px-3 py-2.5 transition hover:bg-primary/5 ${!n.readAt ? "bg-primary/5" : ""}`}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className={`border-b border-primary/10 px-3 py-2.5 ${!n.readAt ? "bg-primary/5" : ""}`}>{inner}</div>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        aria-label="Notifikace"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void markAllRead();
        }}
        className="relative shrink-0 rounded-md border border-primary/25 p-1.5 text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-background shadow-[0_0_10px_-2px_var(--color-accent)]">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {panel}
    </>
  );
}
