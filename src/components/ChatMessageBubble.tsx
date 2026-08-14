import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseMediaMessage } from "@/lib/dm-media";

type Message = { id: string; content: string; createdAt: string; mine: boolean };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ChatMessageBubble({ message }: { message: Message }) {
  const media = parseMediaMessage(message.content);
  const imagePath = media?.type === "image" ? media.path : null;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<"image" | "gif" | null>(null);

  useEffect(() => {
    let alive = true;
    setSignedUrl(null);
    if (!imagePath) return;
    void supabase.storage.from("dm-media").createSignedUrl(imagePath, 60 * 60).then(({ data }) => {
      if (alive) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [imagePath]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const boxClass = `max-w-[82%] rounded-2xl px-3 py-2 text-sm ${message.mine ? "bg-primary text-primary-foreground" : "border border-primary/20 bg-primary/5 text-foreground"}`;

  if (media?.type === "gif") {
    return <>
      <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
        <div className={boxClass}>
          <button type="button" onClick={() => setLightbox("gif")} className="block cursor-zoom-in overflow-hidden rounded-xl" aria-label="Zvětšit GIF">
            <img src={media.url} alt={media.title ?? "Sportovní GIF"} loading="lazy" className="max-h-64 max-w-full rounded-xl object-contain transition hover:opacity-90" />
          </button>
          <div className={`mt-1 font-mono text-[8px] ${message.mine ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>{media.source ?? "GIF"} · {formatTime(message.createdAt)}</div>
        </div>
      </div>
      {lightbox === "gif" && <MediaLightbox src={media.url} alt={media.title ?? "Sportovní GIF"} onClose={() => setLightbox(null)} />}
    </>;
  }

  if (media?.type === "image") {
    return <>
      <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
        <div className={boxClass}>
          {signedUrl ? (
            <button type="button" onClick={() => setLightbox("image")} className="block cursor-zoom-in overflow-hidden rounded-xl" aria-label="Zvětšit obrázek">
              <img src={signedUrl} alt="Obrázek v chatu" loading="lazy" className="max-h-72 max-w-full rounded-xl object-contain transition hover:opacity-90" />
            </button>
          ) : <div className="flex h-32 w-40 items-center justify-center rounded-xl bg-black/20 text-xs text-muted-foreground">Načítám obrázek…</div>}
          {media.caption && <p className="mt-2 whitespace-pre-wrap break-words">{media.caption}</p>}
          <div className={`mt-1 font-mono text-[8px] ${message.mine ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>{formatTime(message.createdAt)}</div>
        </div>
      </div>
      {lightbox === "image" && signedUrl && <MediaLightbox src={signedUrl} alt="Obrázek v chatu" onClose={() => setLightbox(null)} />}
    </>;
  }

  return <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={boxClass}>
    <p className="whitespace-pre-wrap break-words">{message.content}</p>
    <p className={`mt-1 font-mono text-[9px] ${message.mine ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>{formatTime(message.createdAt)}</p>
  </div></div>;
}

function MediaLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Zvětšené médium" onClick={onClose}>
    <button type="button" aria-label="Zavřít" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/50 p-2 text-white hover:bg-black/70"><X className="h-5 w-5" /></button>
    <div className="flex max-h-[92vh] max-w-[94vw] items-center justify-center" onClick={(event) => event.stopPropagation()}>
      <img src={src} alt={alt} className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
    </div>
  </div>;
}
