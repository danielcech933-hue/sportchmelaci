import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseMediaMessage } from "@/lib/dm-media";

type Message = { id: string; content: string; createdAt: string; mine: boolean };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ChatMessageBubble({ message }: { message: Message }) {
  const media = parseMediaMessage(message.content);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSignedUrl(null);
    if (!media || media.type !== "image") return;
    void supabase.storage.from("dm-media").createSignedUrl(media.path, 60 * 60).then(({ data }) => {
      if (alive) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [media]);

  const boxClass = `max-w-[82%] rounded-2xl px-3 py-2 text-sm ${message.mine ? "bg-primary text-primary-foreground" : "border border-primary/20 bg-primary/5 text-foreground"}`;

  if (media?.type === "gif") {
    return <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={boxClass}>
      <img src={media.url} alt={media.title ?? "Sportovní GIF"} loading="lazy" className="max-h-64 max-w-full rounded-xl object-contain" />
      <div className={`mt-1 font-mono text-[8px] ${message.mine ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>{media.source ?? "GIF"} · {formatTime(message.createdAt)}</div>
    </div></div>;
  }

  if (media?.type === "image") {
    return <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={boxClass}>
      {signedUrl ? <img src={signedUrl} alt="Obrázek v chatu" loading="lazy" className="max-h-72 max-w-full rounded-xl object-contain" /> : <div className="flex h-32 w-40 items-center justify-center rounded-xl bg-black/20 text-xs text-muted-foreground">Načítám obrázek…</div>}
      {media.caption && <p className="mt-2 whitespace-pre-wrap break-words">{media.caption}</p>}
      <div className={`mt-1 font-mono text-[8px] ${message.mine ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>{formatTime(message.createdAt)}</div>
    </div></div>;
  }

  return <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={boxClass}>
    <p className="whitespace-pre-wrap break-words">{message.content}</p>
    <p className={`mt-1 font-mono text-[9px] ${message.mine ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>{formatTime(message.createdAt)}</p>
  </div></div>;
}
