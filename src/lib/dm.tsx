import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, X, Send, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/lib/avatars";
import { useProfileDirectory } from "@/lib/profile-links";

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

const toDm = (r: Row): DirectMessage => ({
  id: r.id,
  senderId: r.sender_id,
  recipientId: r.recipient_id,
  content: r.content,
  readAt: r.read_at,
  createdAt: r.created_at,
});

type DmCtx = {
  messages: DirectMessage[];
  unread: number;
  openChat: (peerId: string) => void;
  openInbox: () => void;
  close: () => void;
  reload: () => void;
};

const Ctx = createContext<DmCtx | null>(null);

export function useDm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDm must be used inside DmProvider");
  return ctx;
}

export function DmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [view, setView] = useState<null | { kind: "inbox" } | { kind: "chat"; peerId: string }>(null);

  const load = useCallback(async () => {
    if (!user) {
      setMessages([]);
      return;
    }
    const { data } = await supabase
      .from("direct_messages")
      .select("id,sender_id,recipient_id,content,read_at,created_at")
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages(((data ?? []) as Row[]).map(toDm));
  }, [user]);

  const upsert = useCallback((row: Row) => {
    setMessages((prev) => {
      const dm = toDm(row);
      const i = prev.findIndex((m) => m.id === dm.id);
      if (i === -1) return [...prev, dm].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const next = [...prev];
      next[i] = dm;
      return next;
    });
  }, []);

  useEffect(() => {
    load();
    if (!user) return;

    let ch: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const subscribe = async () => {
      // Realtime needs the current access token, otherwise RLS blocks every event
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;

      ch = supabase
        .channel(`dm-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "direct_messages" },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<Row>;
              if (old?.id) setMessages((prev) => prev.filter((m) => m.id !== old.id));
              return;
            }
            upsert(payload.new as Row);
          },
        )
        .subscribe((status) => {
          // If the socket cannot establish, fall back to the polling interval below
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") load();
        });
    };

    subscribe();

    // Safety net: keep inbox fresh even if the websocket drops
    const iv = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      sub.subscription.unsubscribe();
      if (ch) supabase.removeChannel(ch);
    };
  }, [user, load, upsert]);

  const unread = useMemo(
    () => messages.filter((m) => m.recipientId === user?.id && !m.readAt).length,
    [messages, user?.id],
  );

  const value: DmCtx = {
    messages,
    unread,

    openChat: (peerId) => setView({ kind: "chat", peerId }),
    openInbox: () => setView({ kind: "inbox" }),
    close: () => setView(null),
    reload: load,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {view && user && (
        <DmOverlay
          view={view}
          onBack={() => setView({ kind: "inbox" })}
          onClose={() => setView(null)}
          onOpenChat={(peerId) => setView({ kind: "chat", peerId })}
        />
      )}
    </Ctx.Provider>
  );
}

/** Header chat bubble with unread badge. */
export function DmBell() {
  const { user } = useAuth();
  const { unread, openInbox } = useDm();
  const mentions = useLobbyMentions();
  const total = unread + mentions;
  if (!user) return null;
  return (
    <button
      aria-label="Zprávy"
      onClick={openInbox}
      className="relative shrink-0 rounded-md border border-primary/25 p-1.5 text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
    >
      <MessageCircle className="h-4 w-4" />
      {total > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-background shadow-[0_0_10px_-2px_var(--color-accent)]">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </button>
  );
}


function formatTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DmOverlay({
  view,
  onBack,
  onClose,
  onOpenChat,
}: {
  view: { kind: "inbox" } | { kind: "chat"; peerId: string };
  onBack: () => void;
  onClose: () => void;
  onOpenChat: (peerId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-primary/30 bg-background/95 shadow-[0_0_40px_-10px_var(--color-primary)] sm:h-[70vh] sm:max-w-lg sm:rounded-2xl">
        {view.kind === "inbox" ? (
          <InboxPane onClose={onClose} onOpenChat={onOpenChat} />
        ) : (
          <ChatPane peerId={view.peerId} onBack={onBack} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function InboxPane({ onClose, onOpenChat }: { onClose: () => void; onOpenChat: (id: string) => void }) {
  const { user } = useAuth();
  const { messages } = useDm();
  const { byNick, profiles } = useProfileDirectory();
  void byNick;

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const convos = useMemo(() => {
    const map = new Map<string, { peerId: string; last: DirectMessage; unread: number }>();
    for (const m of messages) {
      const peerId = m.senderId === user?.id ? m.recipientId : m.senderId;
      const cur = map.get(peerId);
      const unread = (cur?.unread ?? 0) + (m.recipientId === user?.id && !m.readAt ? 1 : 0);
      map.set(peerId, { peerId, last: cur && cur.last.createdAt > m.createdAt ? cur.last : m, unread });
    }
    return [...map.values()].sort((a, b) => (a.last.createdAt < b.last.createdAt ? 1 : -1));
  }, [messages, user?.id]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">Zprávy</span>
        <button aria-label="Zavřít" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {convos.length === 0 && (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            Zatím žádné soukromé konverzace. Otevři profil hráče a napiš mu.
          </p>
        )}
        {convos.map((c) => {
          const p = byId.get(c.peerId);
          return (
            <button
              key={c.peerId}
              onClick={() => onOpenChat(c.peerId)}
              className="flex w-full items-center gap-3 border-b border-primary/10 px-4 py-3 text-left transition hover:bg-primary/5"
            >
              <Avatar path={p?.avatar_path ?? null} nickname={p?.nickname ?? "?"} size={36} zoomable={false} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{p?.nickname ?? "Hráč"}</span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    {formatTime(c.last.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {c.last.senderId === user?.id ? "Ty: " : ""}
                  {c.last.content}
                </span>
              </span>
              {c.unread > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-background">
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ChatPane({ peerId, onBack, onClose }: { peerId: string; onBack: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const { messages, reload } = useDm();
  const { profiles } = useProfileDirectory();
  const peer = profiles.find((p) => p.id === peerId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const thread = useMemo(
    () => messages.filter((m) => m.senderId === peerId || m.recipientId === peerId),
    [messages, peerId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  useEffect(() => {
    const unread = thread.filter((m) => m.recipientId === user?.id && !m.readAt).map((m) => m.id);
    if (!unread.length) return;
    supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => reload());
  }, [thread, user?.id, reload]);

  const send = async () => {
    const content = text.trim();
    if (!content || !user || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: user.id, recipient_id: peerId, content });
    if (error) setText(content);
    setSending(false);
    reload();
  };

  return (
    <>
      <header className="flex items-center gap-2 border-b border-primary/20 px-3 py-2.5">
        <button aria-label="Zpět" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar path={peer?.avatar_path ?? null} nickname={peer?.nickname ?? "?"} size={30} zoomable={false} />
        <Link
          to="/profile/$id"
          params={{ id: peerId }}
          onClick={onClose}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:text-primary"
        >
          {peer?.nickname ?? "Hráč"}
        </Link>
        <button aria-label="Zavřít" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {thread.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Napiš první zprávu 👋</p>
        )}
        {thread.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "border border-primary/20 bg-primary/5 text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-1 font-mono text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-primary/20 p-2.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Napsat zprávu…"
          className="min-w-0 flex-1 rounded-xl border border-primary/25 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Odeslat"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}

const LOBBY_SEEN_KEY = "lobby-chat-seen-at";

/** Marks the public lobby chat as seen (clears mention badge). */
export function markLobbySeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOBBY_SEEN_KEY, new Date().toISOString());
  window.dispatchEvent(new Event("lobby-seen"));
}

/** Count of unseen public-lobby messages that @mention the current user. */
export function useLobbyMentions(): number {
  const { user, nickname } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user || !nickname) {
      setCount(0);
      return;
    }
    const since = (typeof window !== "undefined" && localStorage.getItem(LOBBY_SEEN_KEY)) || new Date(0).toISOString();
    const { data } = await supabase
      .from("chat_messages")
      .select("id,content,user_id,created_at")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    const needle = "@" + nickname.toLowerCase();
    setCount(
      ((data ?? []) as Array<{ content: string; user_id: string }>).filter(
        (m) => m.user_id !== user.id && m.content.toLowerCase().includes(needle),
      ).length,
    );
  }, [user, nickname]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("lobby-mentions-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();
    const onSeen = () => load();
    window.addEventListener("lobby-seen", onSeen);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("lobby-seen", onSeen);
    };
  }, [user, load]);

  return count;
}
