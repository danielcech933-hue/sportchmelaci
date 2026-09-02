import { useEffect, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

 type ProfileMedia = { id: string; user_id: string; media_url: string; caption: string | null; match_id: string | null; created_at: string };
const db = supabase as any;

export function ProfileMediaGallery({ userId }: { userId: string }) {
  const { user, nickname } = useAuth();
  const [items, setItems] = useState<ProfileMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const self = user?.id === userId;

  const load = async () => {
    const { data } = await db.from("profile_media").select("id,user_id,media_url,caption,match_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as ProfileMedia[]);
  };
  useEffect(() => { void load(); }, [userId]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !user || !self) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { window.alert("Použij obrázek do 10 MB."); return; }
    try {
      setBusy(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("social-media").upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const mediaUrl = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
      const { error } = await db.from("profile_media").insert({ user_id: user.id, media_url: mediaUrl, caption: "Moment ze zápasu", match_id: null });
      if (error) throw error;
      await load();
    } catch (error: any) { window.alert(error?.message ?? "Fotku se nepodařilo nahrát."); } finally { setBusy(false); }
  };

  const remove = async (item: ProfileMedia) => {
    if (!self) return;
    await db.from("profile_media").delete().eq("id", item.id).eq("user_id", userId);
    await load();
  };

  return <section className="mt-5 rounded-[26px] border border-white/8 bg-black/20 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><div className="aaa-meta text-amber-200/70">MATCH MOMENTS</div><h2 className="mt-1 font-display text-3xl tracking-[.12em] text-white">FOTKY ZE ZÁPASŮ</h2></div>{self && <label className="aaa-cta inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.14em]"><ImagePlus className="h-4 w-4" /> {busy ? "Nahrávám…" : "Přidat fotku"}<input type="file" accept="image/*" disabled={busy} className="hidden" onChange={upload} /></label>}</div>
    {!items.length ? <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center"><Camera className="mx-auto h-7 w-7 text-white/20" /><p className="mt-2 text-sm text-white/35">{self ? "Přidej první moment ze zápasu na svůj profil." : "Hráč zatím nemá žádné fotky ze zápasů."}</p></div> : <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <div key={item.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-black"><img src={item.media_url} alt={item.caption ?? "Moment ze zápasu"} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{self && <button type="button" onClick={() => void remove(item)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-xl bg-black/65 text-white/70 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-rose-200" aria-label="Smazat fotku"><Trash2 className="h-4 w-4" /></button>}</div>)}</div>}
  </section>;
}
