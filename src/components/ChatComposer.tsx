import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, Smile, Send, Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { EMOJI, encodeMediaMessage, type MediaMessage } from "@/lib/dm-media";
import { LOCAL_SPORT_GIFS } from "@/lib/dm-local-gifs";
import { isGiphyConfigured, searchGiphy, trendingGiphy, type GiphyItem } from "@/lib/giphy";
import { isKlipyConfigured, searchKlipy, trendingKlipy, type KlipyItem } from "@/lib/klipy";

type SentCallback = () => void;
type LocalGifItem = { id: string; title: string; url: string; preview: string; sport: string };

type GifItem = {
  id: string;
  title: string;
  url: string;
  preview: string;
  source: "SPORTCHMELACI" | "KLIPY" | "GIPHY";
};

function extFor(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined;
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "bin";
}

export function ChatComposer({ userId, peerId, onSent }: { userId: string; peerId: string; onSent: SentCallback }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [gifError, setGifError] = useState<string | null>(null);
  const [klipyGifs, setKlipyGifs] = useState<KlipyItem[]>([]);
  const [giphyGifs, setGiphyGifs] = useState<GiphyItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [provider, setProvider] = useState<"klipy" | "giphy" | "local">(isKlipyConfigured() ? "klipy" : isGiphyConfigured() ? "giphy" : "local");
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiGroups = useMemo(() => [EMOJI.slice(0, 18), EMOJI.slice(18)], []);
  const localGifs = useMemo<LocalGifItem[]>(() => {
    const query = gifQuery.trim().toLowerCase();
    return LOCAL_SPORT_GIFS.filter((gif) => !query || `${gif.title} ${gif.sport}`.toLowerCase().includes(query));
  }, [gifQuery]);

  useEffect(() => {
    if (!gifOpen || provider === "local") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setMediaLoading(true);
      setGifError(null);
      try {
        if (provider === "klipy") {
          const data = gifQuery.trim() ? await searchKlipy(gifQuery, { limit: 24 }) : await trendingKlipy({ limit: 24 });
          if (!cancelled) setKlipyGifs(data);
        } else {
          const data = gifQuery.trim() ? await searchGiphy(gifQuery, { limit: 24 }) : await trendingGiphy({ limit: 24 });
          if (!cancelled) setGiphyGifs(data);
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = provider === "klipy" && isGiphyConfigured() ? "giphy" : "local";
          setProvider(fallback);
          setGifError(error instanceof Error ? error.message : "Online GIF galerii se nepodařilo načíst.");
        }
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    }, gifQuery.trim() ? 300 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [gifOpen, gifQuery, provider]);

  const setFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setGifError("Vyber obrázek.");
    if (file.size > 8 * 1024 * 1024) return setGifError("Obrázek může mít maximálně 8 MB.");
    setGifError(null);
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachment(file);
    setAttachmentPreview(URL.createObjectURL(file));
    setGifOpen(false);
  };

  const send = async () => {
    if (sending) return;
    const cleanText = text.trim();
    if (!cleanText && !attachment) return;
    setSending(true);
    try {
      const messageId = crypto.randomUUID();
      let content = cleanText;
      if (attachment) {
        const path = `${userId}/${messageId}/${messageId}.${extFor(attachment)}`;
        const { error: uploadError } = await supabase.storage.from("dm-media").upload(path, attachment, { cacheControl: "3600", contentType: attachment.type, upsert: false });
        if (uploadError) throw uploadError;
        content = encodeMediaMessage({ type: "image", path, caption: cleanText || undefined });
      }
      const { error } = await supabase.from("direct_messages").insert({ id: messageId, sender_id: userId, recipient_id: peerId, content });
      if (error) throw error;
      setText(""); setAttachment(null); if (attachmentPreview) URL.revokeObjectURL(attachmentPreview); setAttachmentPreview(null); setEmojiOpen(false); onSent();
    } catch (error) {
      setGifError(error instanceof Error ? error.message : "Zprávu se nepodařilo odeslat.");
    } finally { setSending(false); }
  };

  const sendGif = async (gif: GifItem) => {
    if (sending) return;
    setSending(true);
    try {
      const media: MediaMessage = { type: "gif", url: gif.url, title: gif.title, source: gif.source };
      const { error } = await supabase.from("direct_messages").insert({ id: crypto.randomUUID(), sender_id: userId, recipient_id: peerId, content: encodeMediaMessage(media) });
      if (error) throw error;
      setGifOpen(false); setGifQuery(""); setGifError(null); onSent();
    } catch (error) {
      setGifError(error instanceof Error ? error.message : "GIF se nepodařilo odeslat.");
    } finally { setSending(false); }
  };

  const submitGifSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); };

  return (
    <div className="border-t border-primary/20 bg-background/90 p-2.5">
      {(emojiOpen || gifOpen || attachmentPreview || gifError) && (
        <div className="mb-2 rounded-2xl border border-primary/20 bg-background/95 p-2.5 shadow-lg">
          {attachmentPreview && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 p-2">
              <img src={attachmentPreview} alt="Náhled přílohy" className="h-16 w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1 text-xs text-muted-foreground"><p className="truncate font-semibold text-foreground">{attachment?.name}</p><p>{Math.round((attachment?.size ?? 0) / 1024)} KB</p></div>
              <button type="button" aria-label="Zrušit přílohu" onClick={() => { setAttachment(null); if (attachmentPreview) URL.revokeObjectURL(attachmentPreview); setAttachmentPreview(null); }} className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          )}
          {emojiOpen && <div className="space-y-2">{emojiGroups.map((group, i) => <div key={i} className="flex flex-wrap gap-1">{group.map((emoji) => <button key={emoji} type="button" onClick={() => setText((value) => value + emoji)} className="rounded-lg px-2 py-1.5 text-xl transition hover:bg-primary/10">{emoji}</button>)}</div>)}</div>}
          {gifOpen && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-accent">GIF SYSTEM</p><p className="text-xs text-muted-foreground">{provider === "klipy" ? "Online KLIPY" : provider === "giphy" ? "Online GIPHY" : "Lokální SportChmeláci"}</p></div>
                <div className="flex gap-1">
                  {isKlipyConfigured() && <button type="button" onClick={() => { setProvider("klipy"); setGifError(null); }} className={`rounded-lg border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${provider === "klipy" ? "border-accent/50 text-accent" : "border-primary/20 text-muted-foreground"}`}>KLIPY</button>}
                  {isGiphyConfigured() && <button type="button" onClick={() => { setProvider("giphy"); setGifError(null); }} className={`rounded-lg border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${provider === "giphy" ? "border-accent/50 text-accent" : "border-primary/20 text-muted-foreground"}`}>GIPHY</button>}
                  <button type="button" onClick={() => { setProvider("local"); setGifError(null); }} className={`rounded-lg border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${provider === "local" ? "border-accent/50 text-accent" : "border-primary/20 text-muted-foreground"}`}>LOKÁLNÍ</button>
                </div>
              </div>
              <form onSubmit={submitGifSearch} className="flex gap-2"><input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder={provider === "klipy" ? "Search KLIPY…" : provider === "giphy" ? "Hledat na GIPHY…" : "Hledat ve SportChmeláci GIF galerii…"} className="w-full rounded-xl border border-primary/20 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50" /></form>
              {provider === "klipy" ? (
                <>
                  {mediaLoading && <div className="flex items-center justify-center py-8 text-accent"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                  {!mediaLoading && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{klipyGifs.map((gif) => <button key={gif.id} type="button" onClick={() => void sendGif({ id: gif.id, title: gif.title, url: gif.fixedWidth.url, preview: gif.preview.url, source: "KLIPY" })} className="overflow-hidden rounded-xl border border-primary/10 bg-background transition hover:scale-[1.02] hover:border-accent/50"><img src={gif.preview.url} alt={gif.title} className="aspect-square w-full object-cover" loading="lazy" /></button>)}</div>}
                  {!mediaLoading && !klipyGifs.length && <p className="py-5 text-center text-xs text-muted-foreground">Nic nenalezeno. Zkus jiný výraz.</p>}
                  <div className="flex items-center justify-between gap-2"><p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Search KLIPY · Powered by KLIPY</p><Link to="/gif-studio" className="inline-flex items-center gap-1 rounded-lg border border-accent/30 px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest text-accent"><Sparkles className="h-3 w-3" /> AI GIF Studio</Link></div>
                </>
              ) : provider === "giphy" ? (
                <>
                  {mediaLoading && <div className="flex items-center justify-center py-8 text-accent"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                  {!mediaLoading && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{giphyGifs.map((gif) => <button key={gif.id} type="button" onClick={() => void sendGif({ id: gif.id, title: gif.title, url: gif.images.fixedWidth.url, preview: gif.images.preview.url, source: "GIPHY" })} className="overflow-hidden rounded-xl border border-primary/10 bg-background transition hover:scale-[1.02] hover:border-accent/50"><img src={gif.images.preview.url} alt={gif.title} className="aspect-square w-full object-cover" loading="lazy" /></button>)}</div>}
                  {!mediaLoading && !giphyGifs.length && <p className="py-5 text-center text-xs text-muted-foreground">Nic nenalezeno. Zkus jiný výraz.</p>}
                  <p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Powered by GIPHY</p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">{Array.from(new Set(LOCAL_SPORT_GIFS.map((gif) => gif.sport))).map((sport) => <button key={sport} type="button" onClick={() => setGifQuery(sport)} className="rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-accent">{sport}</button>)}</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{localGifs.map((gif) => <button key={gif.id} type="button" onClick={() => void sendGif({ id: gif.id, title: gif.title, url: gif.url, preview: gif.preview, source: "SPORTCHMELACI" })} className="overflow-hidden rounded-xl border border-primary/10 bg-background transition hover:scale-[1.02] hover:border-primary/40"><img src={gif.preview} alt={gif.title} className="aspect-square w-full object-cover" loading="lazy" /></button>)}</div>
                  {!localGifs.length && <p className="py-5 text-center text-xs text-muted-foreground">Nic nenalezeno. Zkus třeba „Fotbal“ nebo „Vítězství“.</p>}
                  <p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Vlastní sportovní galerie · bez API klíče</p>
                </>
              )}
            </div>
          )}
          {gifError && <p className="mt-2 text-[10px] text-rose-300">{gifError}</p>}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-1.5">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
        <button type="button" aria-label="Přidat fotku" title="Přidat fotku" onClick={() => fileRef.current?.click()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-primary"><ImagePlus className="h-4 w-4" /></button>
        <button type="button" aria-label="Emoji" title="Emoji" onClick={() => { setEmojiOpen((value) => !value); setGifOpen(false); }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-primary"><Smile className="h-4 w-4" /></button>
        <button type="button" aria-label="GIF" title="GIF" onClick={() => { setGifOpen((value) => !value); setEmojiOpen(false); setGifError(null); }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 text-accent hover:border-accent/50"><span className="font-mono text-[10px] font-black">GIF</span></button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={attachment ? "Volitelné, přidej popisek…" : "Napsat zprávu…"} className="min-w-0 flex-1 rounded-xl border border-primary/25 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60" />
        <button type="submit" disabled={(!text.trim() && !attachment) || sending} aria-label="Odeslat" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>
    </div>
  );
}
