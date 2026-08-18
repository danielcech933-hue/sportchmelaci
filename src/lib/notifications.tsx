import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, ChevronRight, CircleDollarSign, Trophy, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  tournamentId: string | null;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

type Filter = "all" | "match" | "team" | "system";

function classify(kind: string): Exclude<Filter, "all"> {
  const k = kind.toLowerCase();
  if (k.includes("team") || k.includes("squad") || k.includes("invite")) return "team";
  if (k.includes("match") || k.includes("game") || k.includes("score") || k.includes("result") || k.includes("tournament")) return "match";
  return "system";
}

function iconFor(kind: string) {
  const type = classify(kind);
  if (type === "team") return Users;
  if (type === "match") return Trophy;
  if (kind.toLowerCase().includes("bet") || kind.toLowerCase().includes("wallet")) return CircleDollarSign;
  return Zap;
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
      .limit(60);
    setItems((data ?? []).map((n) => ({
      id: n.id,
      tournamentId: n.tournament_id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      readAt: n.read_at,
      createdAt: n.created_at,
    })));
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const ch = supabase
      .channel("notifications-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    const t = window.setInterval(() => void load(), 30_000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
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
  const diff = Math.max(0, Date.now() - d.getTime());
  if (diff < 60_000) return "právě teď";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function NotificationsBell() {
  const { user } = useAuth();
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const filtered = useMemo(() => items.filter((n) => filter === "all" || classify(n.kind) === filter), [filter, items]);
  const liveCount = useMemo(() => items.filter((n) => classify(n.kind) === "match" && !n.readAt).length, [items]);

  if (!user) return null;

  const panel = open && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-start justify-end p-2 sm:p-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + .55rem)" }}>
          <button aria-label="Zavřít notifikace" className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div ref={panelRef} role="dialog" aria-label="Command Center — notifikace" className="relative mt-11 w-full max-w-[31rem] overflow-hidden rounded-[1.5rem] border border-primary/25 bg-[linear-gradient(165deg,rgba(9,14,21,.98),rgba(2,5,10,.985))] shadow-[0_32px_110px_-35px_rgba(255,204,68,.38)] backdrop-blur-2xl sm:mt-10">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="relative border-b border-white/8 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[8px] font-black uppercase tracking-[.3em] text-accent/70">COMMAND CENTER · ACTIVITY</p>
                  <div className="mt-1 flex items-center gap-2"><h2 className="font-display text-2xl tracking-[.1em] text-white sm:text-3xl">NOTIFIKAČNÍ HUB</h2><span className="rounded-full border border-emerald-300/20 bg-emerald-300/8 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.15em] text-emerald-200">LIVE</span></div>
                  <p className="mt-1 text-[11px] text-white/42">Zápasy, týmy, systém a důležité události na jednom místě.</p>
                </div>
                <button type="button" onClick={() => void markAllRead()} disabled={unread === 0} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 font-mono text-[8px] font-black uppercase tracking-[.13em] text-primary disabled:opacity-30"><CheckCheck className="h-3.5 w-3.5" /> Přečíst vše</button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                <Stat label="CELKEM" value={String(items.length)} />
                <Stat label="NOVÉ" value={String(unread)} tone="gold" />
                <Stat label="LIVE" value={String(liveCount)} tone="cyan" />
                <Link to="/activity" onClick={() => setOpen(false)} className="hidden items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/[.025] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.14em] text-white/70 transition hover:border-primary/30 hover:text-primary sm:flex">Live Pulse <ChevronRight className="h-3 w-3" /></Link>
              </div>
            </div>

            <div className="border-b border-white/8 px-3 py-2.5 sm:px-4">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {([['all','Vše'],['match','Zápasy'],['team','Týmy'],['system','Systém']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={cn("shrink-0 rounded-full border px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.14em] transition", filter === value ? "border-primary/40 bg-primary/12 text-primary" : "border-white/8 bg-white/[.02] text-white/40 hover:text-white/75")}>{label}</button>)}
              </div>
            </div>

            <div className="max-h-[min(65vh,34rem)] overflow-y-auto overscroll-contain p-2 sm:p-3">
              {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center"><Bell className="mx-auto h-7 w-7 text-white/15" /><p className="mt-3 font-display text-lg tracking-[.08em] text-white/45">ŽÁDNÉ UDÁLOSTI</p><p className="mt-1 text-[11px] text-white/28">Tady se objeví důležité dění z platformy.</p></div>}
              {filtered.map((n) => {
                const Icon = iconFor(n.kind);
                const unreadItem = !n.readAt;
                const inner = <div className="flex gap-3"><div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", unreadItem ? "border-primary/30 bg-primary/10 text-primary" : "border-white/8 bg-white/[.03] text-white/35")}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={cn("text-xs font-semibold", unreadItem ? "text-white" : "text-white/72")}>{n.title}</p><span className="shrink-0 font-mono text-[8px] uppercase tracking-[.1em] text-white/25">{formatTime(n.createdAt)}</span></div>{n.body && <p className="mt-1 text-[11px] leading-4 text-white/40">{n.body}</p>}<div className="mt-2 flex items-center gap-2"><span className="rounded-full border border-white/8 bg-white/[.025] px-2 py-0.5 font-mono text-[7px] font-black uppercase tracking-[.13em] text-white/30">{n.kind}</span>{unreadItem && <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />}</div></div></div>;
                return n.tournamentId
                  ? <Link key={n.id} to="/tournament" search={{ id: n.tournamentId }} onClick={() => setOpen(false)} className="mb-1.5 block rounded-xl border border-white/7 bg-white/[.018] p-3 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[.035]">{inner}</Link>
                  : <div key={n.id} className="mb-1.5 rounded-xl border border-white/7 bg-white/[.018] p-3">{inner}</div>;
              })}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button ref={buttonRef} aria-label="Notifikace" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-white/[.02] text-muted-foreground transition hover:border-primary/55 hover:text-foreground">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-background shadow-[0_0_10px_-2px_var(--color-accent)]">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {panel}
    </>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "gold" | "cyan" }) {
  const valueClass = tone === "gold" ? "text-primary" : tone === "cyan" ? "text-accent" : "text-white";
  return <div className="rounded-xl border border-white/8 bg-white/[.02] px-3 py-2"><p className="font-mono text-[7px] font-black uppercase tracking-[.16em] text-white/28">{label}</p><p className={cn("mt-0.5 font-display text-lg tracking-wider", valueClass)}>{value}</p></div>;
}
