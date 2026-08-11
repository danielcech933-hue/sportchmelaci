import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface CasinoMessage {
  id: string;
  nickname: string;
  content: string | null;
  emoji: string | null;
  created_at: string;
}

const EMOJIS = ["🔥", "🍺", "😎", "😱", "💰", "🤡", "👑", "💀"];

/** Postranní live chat s animovanými emoji reakcemi (ruleta / poker). */
export function CasinoChat({
  room,
  onEmoji,
  className,
}: {
  room: string;
  onEmoji?: (nickname: string, emoji: string) => void;
  className?: string;
}) {
  const { user, nickname } = useAuth();
  const [messages, setMessages] = useState<CasinoMessage[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const emojiCb = useRef(onEmoji);
  emojiCb.current = onEmoji;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("casino_chat")
      .select("id,nickname,content,emoji,created_at")
      .eq("room", room)
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (!cancelled) setMessages(((data ?? []) as CasinoMessage[]).slice().reverse());
      });

    const channel = supabase
      .channel(`casino-chat-${room}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "casino_chat", filter: `room=eq.${room}` },
        (payload) => {
          const msg = payload.new as CasinoMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-80), msg]));
          if (msg.emoji) emojiCb.current?.(msg.nickname, msg.emoji);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [room]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async (payload: { content?: string; emoji?: string }) => {
    if (!user || !nickname) return;
    await supabase.from("casino_chat").insert({
      room,
      user_id: user.id,
      nickname,
      content: payload.content ?? null,
      emoji: payload.emoji ?? null,
    });
  };

  const canWrite = useMemo(() => !!user && !!nickname, [user, nickname]);

  return (
    <aside className={cn("glass flex h-full min-h-[320px] flex-col overflow-hidden", className)}>
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/80">Live chat</p>
        <span className="live-dot h-2 w-2 rounded-full bg-danger" />
      </header>

      <div ref={listRef} className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 && <p className="text-xs text-muted-foreground">Zatím ticho u stolu…</p>}
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <span className="fx-text font-mono text-[10px] uppercase tracking-widest text-accent">{m.nickname}</span>{" "}
            {m.emoji ? (
              <span className="text-xl align-middle">{m.emoji}</span>
            ) : (
              <span className="text-foreground/85">{m.content}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-border/60 px-3 py-2">
        {EMOJIS.map((e) => (
          <button
            key={e}
            disabled={!canWrite}
            onClick={() => send({ emoji: e })}
            className="rounded-lg border border-border/60 px-1.5 py-0.5 text-base transition hover:scale-125 disabled:opacity-40"
          >
            {e}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          void send({ content: t.slice(0, 300) });
        }}
        className="flex items-center gap-2 border-t border-border/60 px-3 py-2"
      >
        <Smile className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canWrite}
          placeholder={canWrite ? "Napiš zprávu…" : "Přihlas se pro chat"}
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={!canWrite}
          className="rounded-lg border border-primary/50 bg-primary/15 p-1.5 text-primary disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </aside>
  );
}

/** Overlay pro emoji vylétávající nad avatarem hráče u stolu. */
export function FlyingEmoji({ items }: { items: { id: number; emoji: string }[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center">
      {items.map((it) => (
        <span key={it.id} className="emoji-fly absolute text-2xl">
          {it.emoji}
        </span>
      ))}
    </div>
  );
}
