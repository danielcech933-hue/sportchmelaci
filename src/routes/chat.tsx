import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/lib/avatars";
import { NickLink } from "@/lib/profile-links";
import { markLobbySeen } from "@/lib/dm";


export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Courtside — Public Chat" },
      { name: "description", content: "Chat live with other Chmeloví Sportovci players between matches." },
      { property: "og:title", content: "Courtside — Public Chat" },
      { property: "og:description", content: "Chat live with other Chmeloví Sportovci players." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  component: ChatPage,
});

type ChatRow = {
  id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
};

function ChatPage() {
  const { to } = Route.useSearch();
  const { user, nickname, isAdmin, loading } = useAuth();
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAvatarsFor = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id,avatar_path")
      .in("id", ids);
    if (!data) return;
    setAvatars((prev) => {
      const next = { ...prev };
      for (const p of data as Array<{ id: string; avatar_path: string | null }>) {
        next[p.id] = p.avatar_path;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError(error.message); return; }
        const rows = (data ?? []) as ChatRow[];
        setMessages(rows);
        const ids = Array.from(new Set(rows.map((r) => r.user_id)));
        loadAvatarsFor(ids);
      });

    const channel = supabase
      .channel("public-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as ChatRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          setAvatars((prev) => {
            if (row.user_id in prev) return prev;
            loadAvatarsFor([row.user_id]);
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.old as ChatRow;
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [loadAvatarsFor]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    markLobbySeen();
  }, [messages]);


  useEffect(() => { inputRef.current?.focus(); }, [user]);

  useEffect(() => {
    if (to) setInput((v) => (v ? v : `@${to} `));
  }, [to]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!user || !nickname) return;
    const content = input.trim();
    if (!content) return;
    if (content.length > 500) { setError("Zpráva je moc dlouhá (max 500)."); return; }
    setSending(true); setError(null);
    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      nickname,
      content,
    });
    setSending(false);
    if (error) { setError(error.message); return; }
    setInput("");
    inputRef.current?.focus();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) setError(error.message);
  }

  return (
    <main className="relative mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="relative flex items-center gap-3 p-4 sm:p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
            <MessagesSquare className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h1 className="font-display text-3xl tracking-widest neon-text sm:text-4xl">PUBLIC CHAT</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// Chmeloví Sportovci lounge</p>
          </div>
        </div>
      </section>

      <section className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
        <div ref={scrollRef} className="relative h-[55vh] min-h-[320px] space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <p className="mt-10 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              // no messages yet — say hi
            </p>
          )}
          {messages.map((m) => {
            const mine = user?.id === m.user_id;
            const canDelete = mine || isAdmin;
            const when = new Date(m.created_at);
            const avatarPath = avatars[m.user_id] ?? null;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && <Avatar path={avatarPath} nickname={m.nickname} size={32} />}
                <div className={`group max-w-[85%] rounded-xl border px-3 py-2 ${
                  mine
                    ? "border-primary/50 bg-primary/15 shadow-[0_0_20px_-10px_var(--color-primary)]"
                    : "border-primary/20 bg-background/70"
                }`}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-sm tracking-wider text-primary neon-text"><NickLink nickname={m.nickname} userId={m.user_id} /></span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => remove(m.id)}
                        className="ml-auto opacity-0 transition group-hover:opacity-100"
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-3 w-3 text-danger" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{m.content}</p>
                </div>
                {mine && <Avatar path={avatarPath} nickname={m.nickname} size={32} />}
              </div>
            );
          })}
        </div>

        <div className="relative border-t border-primary/20 bg-background/70 p-3 sm:p-4">
          {!loading && !user ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Sign in to join the conversation.</p>
              <Link to="/auth" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                Sign in →
              </Link>
            </div>
          ) : (
            <form onSubmit={send} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder={nickname ? `Napiš zprávu jako ${nickname}…` : "Napiš zprávu…"}
                className="min-w-0 flex-1 rounded-md border border-primary/30 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-6px_var(--color-primary)] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      </section>
    </main>
  );
}
