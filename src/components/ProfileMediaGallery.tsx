import { useEffect, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ProfileMedia = { id: string; user_id: string; media_url: string; storage_path: string | null; caption: string | null; match_id: string | null; created_at: string };
const db = supabase as any;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const pathFromUrl = (url: string) => {
  const marker = "/storage/v1/object/public/social-media/";
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
};

export function ProfileMediaGallery({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ProfileMedia | null>(null);
  const self = user?.id === userId;

  const load = async () => {
    const { data, error } = await db.from("profile_media").select("id,user_id,media_url,storage_path,caption,match_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
    if (error) {
      toast.error("Fotky profilu se nepodařilo načíst.");
      return;
    }
    setItems((data ?? []) as ProfileMedia[]);
  };

  useEffect(() => { void load(); }, [userId]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !user || !self || busy) return;
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) {
      toast.error("Použij obrázek do 10 MB.");
      return;
    }
    let path: string | null = null;
    try {
      setBusy(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("social-media").upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const mediaUrl = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
      const { error } = await db.from("profile_media").insert({ user_id: user.id, media_url: mediaUrl, storage_path: path, caption: "Moment ze zápasu", match_id: null });
      if (error) throw error;
      toast.success("Fotka přidána na profil.");
      await load();
    } catch (error: any) {
      if (path) await supabase.storage.from("social-media").remove([path]);
      toast.error(error?.message ?? "Fotku se nepodařilo nahrát.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: ProfileMedia) => {
    if (!self || busy) return;
    if (!window.confirm("Smazat fotku z profilu?")) return;
    try {
      setBusy(true);
      const { error } = await db.from("profile_media").delete().eq("id", item.id).eq("user_id", userId);
      if (error) throw error;
      const path = item.storage_path || pathFromUrl(item.media_url);
      if (path) await supabase.storage.from("social-media").remove([path]);
      setViewer((current) => current?.id === item.id ? null : current);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.success("Fotka smazána.");
    } catch (error: any) {
      toast.error(error?.message ?? "Fotku se nepodařilo smazat.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="mt-5 rounded-[26px] border border-white/8 bg-black/20 p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="aaa-meta text-amber-200/70">MATCH MOMENTS</div><h2 className="mt-1 font-display text-3xl tracking-[.12em] text-white">FOTKY ZE ZÁPASŮ</h2><p className="mt-1 text-xs text-white/30">Nejlepší momenty z tvých zápasů na jednom místě.</p></div>{self && <label className="aaa-cta inline-flex min-h-10 cursor-pointer items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.14em]"><ImagePlus className="h-4 w-4" /> {busy ? "Nahrávám…" : "Přidat fotku"}<input type="file" accept="image/*" disabled={busy} className="hidden" onChange={upload} /></label>}</div>
    {!items.length ? <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center"><Camera className="mx-auto h-7 w-7 text-white/20" /><p className="mt-2 text-sm text-white/35">{self ? "Přidej první moment ze zápasu na svůj profil." : "Hráč zatím nemá žádné fotky ze zápasů."}</p></div> : <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <div key={item.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-black"><button type="button" className="absolute inset-0 z-[1] block h-full w-full cursor-zoom-in" onClick={() => setViewer(item)} aria-label="Otevřít fotku"><img src={item.media_url} alt={item.caption ?? "Moment ze zápasu"} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></button>{self && <button type="button" onClick={() => void remove(item)} className="absolute right-2 top-2 z-[2] grid h-9 w-9 place-items-center rounded-xl bg-black/65 text-white/75 backdrop-blur hover:text-rose-200" aria-label="Smazat fotku"><Trash2 className="h-4 w-4" /></button>}</div>)}</div>}

    {viewer && <div className="fixed inset-0 z-[92] grid place-items-center bg-black/92 p-3 backdrop-blur-sm" onClick={() => setViewer(null)}><div className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}><img src={viewer.media_url} alt={viewer.caption ?? "Moment ze zápasu"} className="max-h-[92vh] max-w-full rounded-2xl object-contain" /><div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent p-5 pt-12"><div className="text-sm font-semibold text-white">{viewer.caption || "Moment ze zápasu"}</div>{viewer.match_id && <div className="mt-1 text-[10px] uppercase tracking-[.12em] text-white/40">Zápas · {viewer.match_id}</div>}</div><button type="button" onClick={() => setViewer(null)} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white" aria-label="Zavřít fotku"><X className="h-5 w-5" /></button></div></div>}
  </section>;
}
