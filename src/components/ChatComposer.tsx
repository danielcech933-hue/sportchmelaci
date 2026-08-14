import { useMemo, useRef, useState } from "react";
import { FileImage, ImagePlus, Loader2, Smile, Send, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EMOJI, SPORTS_GIF_QUERIES, encodeMediaMessage, type MediaMessage } from "@/lib/dm-media";

type SentCallback = () => void;

type GifItem = { id: string; title: string; url: string; preview: string };

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
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;
  const emojiGroups = useMemo(() => [EMOJI.slice(0, 18), EMOJI.slice(18)], []);

  const setFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      setGifError("Obrázek může mít maximálně 8 MB.");
      return;
    }
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
        const { error: uploadError } = await supabase.storage.from("dm-media").upload(path, attachment, {
          cacheControl: "3600",
          contentType: attachment.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const media: MediaMessage = { type: "image", path, caption: cleanText || undefined };
        content = encodeMediaMessage(media);
      }
      const { error } = await supabase.from("direct_messages").insert({ id: messageId, sender_id: userId, recipient_id: peerId, content });
      if (error) throw error;
      setText("");
      setAttachment(null);
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
      setEmojiOpen(false);
      onSent();
    } catch (error) {
      setGifError(error instanceof Error ? error.message : "Zprávu se nepodařilo odeslat.");
    } finally {
      setSending(false);
    }
  };

  const searchGifs = async (q: string) => {
    if (!apiKey) {
      setGifError("GIFy zatím nejsou aktivní — chybí VITE_GIPHY_API_KEY.");
      setGifs([]);
      return;
    }
    setGifLoading(true);
    setGifError(null);
    try {
      const params = new URLSearchParams({ api_key: apiKey, q, limit: "12", rating: "g", lang: "cs" });
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params.toString()}`);
      if (!response.ok) throw new Error("GIPHY momentálně neodpovídá.");
      const json = await response.json() as { data?: Array<{ id: string; title?: string; images?: { fixed_width?: { url?: string }; downsized?: { url?: string } } }> };
      setGifs((json.data ?? []).map((item) => ({ id: item.id, title: item.title ?? "Sport GIF", url: item.images?.downsized?.url ?? item.images?.fixed_width?.url ?? "", preview: item.images?.fixed_width?.url ?? item.images?.downsized?.url ?? "" })).filter((item) => item.url && item.preview));
    } catch (error) {
      setGifs([]);
      setGifError(error instanceof Error ? error.message : "GIFy se nepodařilo načíst.");
    } finally {
      setGifLoading(false);
    }
  };

  const sendGif = async (gif: GifItem) => {
    if (sending) return;
    setSending(true);
    try {
      const media: MediaMessage = { type: "gif", url: gif.url, title: gif.title, source: "GIPHY" };
      const { error } = await supabase.from("direct_messages").insert({ id: crypto.randomUUID(), sender_id: userId, recipient_id: peerId, content: encodeMediaMessage(media) });
      if (error) throw error;
      setGifOpen(false);
      setGifQuery("");
      setGifs([]);
      onSent();
    } catch (error) {
      setGifError(error instanceof Error ? error.message : "GIF se nepodařilo odeslat.");
    } finally {
      setSending(false);
    }
  };

  const submitGifSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = gifQuery.trim();
    if (q) void searchGifs(q);
  };

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
          {emojiOpen && (
            <div className="space-y-2">
              {emojiGroups.map((group, i) => <div key={i} className="flex flex-wrap gap-1">{group.map((emoji) => <button key={emoji} type="button" onClick={() => setText((value) => value + emoji)} className="rounded-lg px-2 py-1.5 text-xl transition hover:bg-primary/10">{emoji}</button>)}</div>)}
            </div>
          )}
          {gifOpen && (
            <div className="space-y-2">
              <form onSubmit={submitGifSearch} className="flex gap-2">
                <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder="Hledat sportovní GIF…" className="w-full rounded-xl border border-primary/20 bg-background/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50" /></div>
                <button type="submit" disabled={gifLoading || !gifQuery.trim()} className="rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
              </form>
              <div className="flex gap-1.5 overflow-x-auto pb-1">{SPORTS_GIF_QUERIES.map((preset) => <button key={preset.label} type="button" onClick={() => { setGifQuery(preset.query); void searchGifs(preset.query); }} className="shrink-0 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-accent">{preset.label}</button>)}</div>
              {gifLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{gifs.map((gif) => <button key={gif.id} type="button" onClick={() => void sendGif(gif)} className="overflow-hidden rounded-xl border border-primary/10 bg-background transition hover:scale-[1.02] hover:border-primary/40"><img src={gif.preview} alt={gif.title} className="aspect-square w-full object-cover" loading="lazy" /></button>)}</div>}
              <p className="text-right font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Powered by GIPHY · rating G</p>
            </div>
          )}
          {gifError && <p className="mt-2 text-[10px] text-rose-300">{gifError}</p>}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-1.5">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
        <button type="button" aria-label="Přidat fotku" title="Přidat fotku" onClick={() => fileRef.current?.click()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-primary"><ImagePlus className="h-4 w-4" /></button>
        <button type="button" aria-label="Emoji" title="Emoji" onClick={() => { setEmojiOpen((value) => !value); setGifOpen(false); }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-primary"><Smile className="h-4 w-4" /></button>
        <button type="button" aria-label="GIF" title="GIF" onClick={() => { setGifOpen((value) => !value); setEmojiOpen(false); if (!gifOpen && gifs.length === 0) { const preset = SPORTS_GIF_QUERIES[0].query; setGifQuery(preset); void searchGifs(preset); } }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 text-accent hover:border-accent/50"><span className="font-mono text-[10px] font-black">GIF</span></button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={attachment ? "Volitelné, přidej popisek…" : "Napsat zprávu…"} className="min-w-0 flex-1 rounded-xl border border-primary/25 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60" />
        <button type="submit" disabled={(!text.trim() && !attachment) || sending} aria-label="Odeslat" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>
    </div>
  );
}
