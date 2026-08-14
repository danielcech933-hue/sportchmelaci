import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Sparkles, Upload, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/gif-studio")({
  head: () => ({ meta: [{ title: "AI GIF Studio — SportChmeláci" }, { name: "description", content: "Nahraj sportovní fotku jako předlohu pro budoucí AI GIF tvorbu." }] }),
  component: GifStudio,
});

function GifStudio() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Udělej z fotky vtipný sportovní GIF s oslavou po vítězství.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ id: string; prompt: string; status: string; created_at: string }>>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("ai_gif_requests").select("id,prompt,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setRows((data ?? []) as typeof rows);
  }
  useEffect(() => { void load(); }, [user]);

  async function submit() {
    if (!user || !file || busy) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setMessage("Nahraj obrázek do 10 MB.");
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const id = crypto.randomUUID();
      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "jpg" : "jpg";
      const path = `${user.id}/${id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("ai-gif-source").upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("ai_gif_requests").insert({ id, user_id: user.id, source_path: path, prompt: prompt.trim().slice(0, 500), status: "PENDING_AI", moderation_status: "PENDING" });
      if (error) throw error;
      setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null);
      setMessage("Předloha je uložená. AI generování čeká na AI provider.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Předlohu se nepodařilo uložit.");
    } finally { setBusy(false); }
  }

  if (!user) return <main className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="font-display text-4xl tracking-widest text-primary">AI GIF STUDIO</h1><p className="mt-3 text-sm text-muted-foreground">Pro tvorbu vlastních GIFů se přihlas.</p></main>;

  return <main className="mx-auto max-w-4xl px-4 py-10 pb-28">
    <header className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background/70 to-accent/5 p-5 sm:p-7">
      <div className="flex items-start gap-3"><Sparkles className="mt-1 h-6 w-6 text-accent" /><div><p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/70">SPORTCHMELÁCI · AI CREATIVE LAB</p><h1 className="mt-1 font-display text-3xl uppercase tracking-[0.08em] text-primary sm:text-4xl">AI GIF STUDIO</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Každý přihlášený hráč může přidat vlastní fotku jako předlohu pro vtipný sportovní GIF. Zdrojová fotka je privátní a moderovaná.</p></div></div>
    </header>

    <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-3xl border border-border/60 bg-background/50 p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary"><ImagePlus className="h-4 w-4" /> 1 · Předloha</div>
        <label className="mt-4 flex min-h-64 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-black/10 text-center transition hover:border-primary/60">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const next = e.target.files?.[0]; if (!next) return; setFile(next); if (preview) URL.revokeObjectURL(preview); setPreview(URL.createObjectURL(next)); }} />
          {preview ? <img src={preview} alt="Předloha" className="max-h-72 max-w-full rounded-xl object-contain" /> : <div><Upload className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">Klikni pro nahrání fotky</p><p className="mt-1 text-xs text-muted-foreground">JPG · PNG · WEBP · max 10 MB</p></div>}
        </label>
        <label className="mt-4 block"><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">2 · Co má GIF dělat?</span><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={500} rows={4} className="mt-2 w-full rounded-xl border border-border/60 bg-background/60 px-3 py-3 text-sm outline-none focus:border-primary/50" /></label>
        <button type="button" onClick={() => void submit()} disabled={!file || busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Sparkles className="h-4 w-4" /> {busy ? "Nahrávám…" : "Odeslat do AI GIF fronty"}</button>
        {message && <p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{message}</p>}
      </div>
      <div className="rounded-3xl border border-border/60 bg-background/50 p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary"><ShieldCheck className="h-4 w-4" /> Bezpečnost</div><div className="mt-3 space-y-3 text-sm text-muted-foreground"><p>• Zdrojová fotka je v privátním storage.</p><p>• Obsah má stav moderace.</p><p>• Autor může vlastní požadavek odstranit.</p><p>• Admin může nevhodný obsah skrýt.</p><p>• Bez externího GIPHY API klíče.</p></div><div className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-accent">AI provider</p><p className="mt-1 text-sm">{"Výstupní AI GIF se zatím řadí do fronty. Jakmile projekt připojí image-to-video/GIF provider, tento front-end už má připravený workflow."}</p></div></div>
    </section>

    <section className="mt-5 rounded-3xl border border-border/60 bg-background/50 p-5"><div className="font-mono text-[10px] uppercase tracking-widest text-primary">Moje AI GIF požadavky</div>{!rows.length ? <p className="mt-4 text-sm text-muted-foreground">Zatím žádné požadavky.</p> : <div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-3"><span className="font-mono text-[9px] uppercase tracking-widest text-accent">{row.status}</span><span className="min-w-0 flex-1 truncate text-sm">{row.prompt}</span><span className="font-mono text-[9px] text-muted-foreground">{new Date(row.created_at).toLocaleString("cs-CZ")}</span></div>)}</div>}</section>
  </main>;
}
