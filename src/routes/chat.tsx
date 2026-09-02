import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MessagesSquare, Send, Trash2, Trophy, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/lib/avatars";
import { NickLink } from "@/lib/profile-links";
import { markLobbySeen } from "@/lib/dm";
import { PageHeader, Panel, StateBlock, SkeletonRows } from "@/components/ui-kit";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chmelovci — Komunitní chat" }, { name: "description", content: "Živý komunitní chat Chmelovců pro diskuzi kolem zápasů, výsledků a sázek." }] }),
  validateSearch: (search: Record<string, unknown>) => ({ to: typeof search.to === "string" ? search.to : undefined }),
  component: ChatPage,
});

type ChatRow = { id: string; user_id: string; nickname: string; content: string; created_at: string };

function ChatPage() {
  const { to } = Route.useSearch();
  const { user, nickname, isAdmin, loading } = useAuth();
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAvatarsFor = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase.from("profile_public").select("id,avatar_path").in("id", ids);
    if (!data) return;
    setAvatars((prev) => {
      const next = { ...prev };
      for (const p of data as Array<{ id: string; avatar_path: string | null }>) next[p.id] = p.avatar_path;
      return next;
    });
  }, []);

  const refreshMessages = useCallback(async () => {
    const { data, error } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
    if (error) { setError(error.message); setLoadingMessages(false); return; }
    const rows = (data ?? []) as ChatRow[];
    setMessages(rows);
    setLoadingMessages(false);
    void loadAvatarsFor(Array.from(new Set(rows.map((r) => r.user_id))));
  }, [loadAvatarsFor]);

  useEffect(() => {
    void refreshMessages();
    const channel = supabase.channel("public-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const row = payload.new as ChatRow;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        void loadAvatarsFor([row.user_id]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        const row = payload.old as ChatRow;
        setMessages((prev) => prev.filter((m) => m.id !== row.id));
      })
      .subscribe((status) => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") void refreshMessages(); });
    const poll = window.setInterval(() => void refreshMessages(), 3000);
    const onOnline = () => void refreshMessages();
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshMessages(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(poll); window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisibility); supabase.removeChannel(channel); };
  }, [loadAvatarsFor, refreshMessages]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  useEffect(() => { void markLobbySeen(); }, []);
  useEffect(() => { inputRef.current?.focus(); }, [user]);
  useEffect(() => { if (to) setInput((v) => (v ? v : `@${to} `)); }, [to]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!user || !nickname) return;
    const content = input.trim();
    if (!content) return;
    if (content.length > 500) { setError("Zpráva je moc dlouhá (max 500)."); return; }
    setSending(true); setError(null);
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, nickname, content });
    setSending(false);
    if (error) { setError(error.message); return; }
    setInput(""); void refreshMessages(); inputRef.current?.focus();
  }

  async function remove(id: string) { const { error } = await supabase.from("chat_messages").delete().eq("id", id); if (error) setError(error.message); }

  return (
    <main className="relative mx-auto max-w-4xl px-3 py-6 pb-28 sm:px-4 sm:py-10">
      <PageHeader eyebrow="// KOMUNITA / LIVE CHAT" title="CHMELOVCI CHAT" subtitle="Živá komunitní místnost pro zápasy, výsledky a dění kolem Chmelovců." actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/rankings" className="aaa-ghost inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest"><Trophy className="h-3.5 w-3.5" /> Scoreboard</Link>
          <Link to="/bets" className="aaa-ghost inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest"><Ticket className="h-3.5 w-3.5" /> Sázky</Link>
        </div>
      } className="mb-5" />

      <Panel padded={false} className="overflow-hidden">
        <div className="relative min-h-[55vh] bg-background/50">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
          <div ref={scrollRef} className="relative h-[55vh] min-h-[320px] space-y-3 overflow-y-auto p-4 sm:p-5">
            {loadingMessages ? <SkeletonRows rows={5} /> : error && messages.length === 0 ? <StateBlock state="error" title="Chat se nepodařilo načíst" hint={error} action={<button onClick={() => { setError(null); setLoadingMessages(true); void refreshMessages(); }} className="aaa-cta px-3 py-2 text-xs font-bold">Zkusit znovu</button>} /> : messages.length === 0 ? <StateBlock state="empty" title="Zatím žádné zprávy" hint="Začni konverzaci jako první." /> : messages.map((m) => {
              const mine = user?.id === m.user_id;
              const canDelete = mine || isAdmin;
              const when = new Date(m.created_at);
              const avatarPath = avatars[m.user_id] ?? null;
              return <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && <Avatar path={avatarPath} nickname={m.nickname} size={32} />}
                <div className={`group max-w-[85%] rounded-xl border px-3 py-2 ${mine ? "border-primary/50 bg-primary/15 shadow-[0_0_20px_-10px_var(--color-primary)]" : "border-primary/20 bg-background/70"}`}>
                  <div className="flex items-baseline gap-2"><span className="font-display text-sm tracking-wider text-primary neon-text"><NickLink nickname={m.nickname} userId={m.user_id} /></span><span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>{canDelete && <button onClick={() => void remove(m.id)} className="ml-auto rounded p-1 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" aria-label="Smazat zprávu"><Trash2 className="h-3 w-3 text-danger" /></button>}</div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{m.content}</p>
                </div>
                {mine && <Avatar path={avatarPath} nickname={m.nickname} size={32} />}
              </div>;
            })}
          </div>
          <div className="relative border-t border-primary/20 bg-background/70 p-3 sm:p-4">
            {!loading && !user ? <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Přihlas se a přidej se ke komunitě.</p><Link to="/auth" className="aaa-cta px-3 py-2 text-xs font-semibold">Přihlásit →</Link></div> : <form onSubmit={send} className="flex items-center gap-2"><input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder={nickname ? `Napiš zprávu jako ${nickname}…` : "Napiš zprávu…"} className="min-w-0 min-h-11 flex-1 rounded-[var(--aaa-radius-sm)] border border-primary/30 bg-background/80 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" disabled={sending} /><button type="submit" disabled={sending || !input.trim()} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--aaa-radius-sm)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-6px_var(--color-primary)] transition hover:brightness-110 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Odeslat</button></form>}
            {error && messages.length > 0 && <p className="mt-2 text-xs text-danger">{error}</p>}
          </div>
        </div>
      </Panel>
    </main>
  );
}
