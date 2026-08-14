import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, ExternalLink, MapPin, Pencil, Phone, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/venues")({
  head: () => ({
    meta: [
      { title: "Partnerská sportoviště — Chmeloví Sportovci" },
      { name: "description", content: "Přehled partnerských sportovišť, kde hrajeme zápasy a turnaje ligy Chmeloví Sportovci." },
      { property: "og:title", content: "Partnerská sportoviště — Chmeloví Sportovci" },
      { property: "og:description", content: "Kde hrajeme: kurty, hřiště a haly našich partnerů." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VenuesPage,
});

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  sports: string;
  hours: string;
  phone: string | null;
  note: string;
  booking_url: string | null;
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  sort_order: number;
};

type FormState = Omit<Venue, "id" | "is_active"> & { id?: string; is_active?: boolean };

const EMPTY: FormState = {
  name: "",
  city: "",
  address: "",
  sports: "",
  hours: "",
  phone: "",
  note: "",
  booking_url: "",
  map_url: "",
  latitude: null,
  longitude: null,
  sort_order: 100,
  is_active: true,
};

function VenueMap({ venue }: { venue: Venue | null }) {
  if (!venue?.latitude || !venue?.longitude) {
    return <div className="grid min-h-[360px] place-items-center rounded-2xl border border-primary/15 bg-background/50 p-8 text-center"><div><MapPin className="mx-auto h-10 w-10 text-primary/60" /><p className="mt-3 font-display text-2xl tracking-[0.12em]">MAP LOCKED</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">Admin musí nejdřív doplnit přesné GPS souřadnice sportoviště. Neodhadujeme je podle názvu města.</p></div></div>;
  }
  const d = 0.015;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${venue.longitude - d}%2C${venue.latitude - d}%2C${venue.longitude + d}%2C${venue.latitude + d}&layer=mapnik&marker=${venue.latitude}%2C${venue.longitude}`;
  return <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-[#07110d] shadow-[0_20px_60px_-42px_var(--color-accent)]"><iframe title={`Mapa ${venue.name}`} src={src} loading="lazy" className="h-[360px] w-full border-0 opacity-90" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,204,68,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,204,68,.06)_1px,transparent_1px)] bg-[size:32px_32px] mix-blend-screen" /><div className="absolute left-3 top-3 rounded-lg border border-accent/30 bg-background/75 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-accent backdrop-blur">VENUE // GEO LOCK</div></div>;
}

function VenuesPage() {
  const { isAdmin } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const q = (supabase as any).from("venues").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
    const { data, error: dbError } = await q;
    if (dbError) setError(dbError.message);
    setVenues((data ?? []) as Venue[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => venues.filter((v) => showInactive ? true : v.is_active), [showInactive, venues]);
  const selected = visible.find((v) => v.id === selectedId) ?? visible[0] ?? null;

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    const payload = {
      name: editing.name.trim(), city: editing.city.trim(), address: editing.address?.trim() || null,
      sports: editing.sports.trim(), hours: editing.hours.trim(), phone: editing.phone?.trim() || null,
      note: editing.note.trim(), booking_url: editing.booking_url?.trim() || null, map_url: editing.map_url?.trim() || null,
      latitude: editing.latitude, longitude: editing.longitude, sort_order: Number(editing.sort_order ?? 100), is_active: editing.is_active !== false,
    };
    const table = (supabase as any).from("venues");
    const result = editing.id ? await table.update(payload).eq("id", editing.id) : await table.insert(payload);
    if (result.error) setError(result.error.message);
    else { setEditing(null); await load(); }
    setBusy(false);
  };

  const toggleActive = async (venue: Venue) => {
    const next = !venue.is_active;
    if (!next && typeof window !== "undefined" && !window.confirm(`Deaktivovat sportoviště „${venue.name}“?`)) return;
    setBusy(true);
    const { error: dbError } = await (supabase as any).from("venues").update({ is_active: next }).eq("id", venue.id);
    if (dbError) setError(dbError.message); else await load();
    setBusy(false);
  };

  const deleteVenue = async (venue: Venue) => {
    if (typeof window !== "undefined" && !window.confirm(`Trvale odstranit „${venue.name}“? Použij raději deaktivaci, pokud ji chceš zachovat v historii.`)) return;
    setBusy(true);
    const { error: dbError } = await (supabase as any).from("venues").delete().eq("id", venue.id);
    if (dbError) setError(dbError.message); else await load();
    setBusy(false);
  };

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/30 bg-background/40 p-5 shadow-[0_28px_80px_-52px_var(--color-primary)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// PARTNER VENUES NETWORK</p>
          <h1 className="mt-2 font-display text-4xl tracking-[0.14em] neon-text sm:text-6xl">SPORTOVIŠTĚ</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Rezervace, mapa a rychlý přehled míst, kde hrajeme. Administrátor může údaje měnit přímo z webu.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--color-primary)]">Naplánovat zápas →</Link>
            <Link to="/tournaments" className="rounded-xl border border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Turnaje</Link>
            {isAdmin && <button type="button" onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-xl border border-primary/45 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"><Plus className="h-4 w-4" /> Nové sportoviště</button>}
          </div>
        </div>
      </section>

      {error && <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</div>}

      {isAdmin && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-background/35 px-3 py-2 text-xs"><button onClick={() => setShowInactive((v) => !v)} className="rounded-lg border border-border/60 px-3 py-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary">{showInactive ? "Skrýt deaktivovaná" : "Zobrazit deaktivovaná"}</button><span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">ADMIN MODE · změny jsou chráněny RLS</span></div>}

      {loading ? <div className="mt-6 panel p-10 text-center text-sm text-muted-foreground">Načítám sportoviště…</div> : (
        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="order-2 space-y-3 lg:order-1">
            {visible.map((v) => <article key={v.id} className={`group relative overflow-hidden rounded-2xl border p-4 backdrop-blur transition ${selected?.id === v.id ? "border-primary/65 bg-primary/5 shadow-[0_0_32px_-16px_var(--color-primary)]" : "border-primary/20 bg-background/55 hover:border-primary/45"}`}>
              <button type="button" onClick={() => setSelectedId(v.id)} className="absolute inset-0 z-0" aria-label={`Zobrazit ${v.name} na mapě`} />
              <div className="relative z-10 pointer-events-none">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl tracking-wide">{v.name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" /> {v.address || v.city}</p></div><span className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${v.is_active ? "border-accent/30 text-accent" : "border-danger/30 text-danger"}`}>{v.is_active ? "ACTIVE" : "OFF"}</span></div>
                <p className="mt-3 text-sm text-foreground/90">{v.sports}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5 font-mono"><Clock className="h-3.5 w-3.5 text-accent" />{v.hours}</span>{v.phone && <span className="inline-flex items-center gap-1.5 font-mono"><Phone className="h-3.5 w-3.5 text-accent" />{v.phone}</span>}</div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{v.note}</p>
                <div className="pointer-events-auto mt-4 flex flex-wrap gap-2"><a href={v.booking_url || undefined} onClick={(e) => !v.booking_url && e.preventDefault()} target={v.booking_url ? "_blank" : undefined} rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${v.booking_url ? "bg-primary text-primary-foreground shadow-[0_0_18px_-8px_var(--color-primary)]" : "cursor-not-allowed border border-border/50 text-muted-foreground/50"}`}>REZERVOVAT <ExternalLink className="h-3.5 w-3.5" /></a>{(v.map_url || (v.latitude && v.longitude)) && <a href={v.map_url || `https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=17/${v.latitude}/${v.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10">MAPA <MapPin className="h-3.5 w-3.5" /></a>}{isAdmin && <><button onClick={() => setEditing(v)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 px-3 py-2 text-xs text-primary hover:bg-primary/10"><Pencil className="h-3.5 w-3.5" /> Upravit</button><button onClick={() => void toggleActive(v)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/25 px-3 py-2 text-xs text-danger hover:bg-danger/10">{v.is_active ? <Trash2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />} {v.is_active ? "Deaktivovat" : "Aktivovat"}</button><button onClick={() => void deleteVenue(v)} disabled={busy} aria-label="Trvale odstranit" className="rounded-lg border border-danger/15 px-2.5 py-2 text-danger/70 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></>}</div>
              </div>
            </article>)}
            {!visible.length && <div className="panel p-10 text-center text-sm text-muted-foreground">Žádná aktivní sportoviště.</div>}
          </div>

          <div className="order-1 lg:order-2"><VenueMap venue={selected} /></div>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-primary/15 bg-background/40 p-4 text-center"><p className="text-sm text-muted-foreground">Chceš přidat nové sportoviště do sítě? <Link to="/support" className="inline-flex items-center gap-1 text-primary hover:underline">Napiš nám <ExternalLink className="h-3.5 w-3.5" /></Link></p></section>

      {editing && isAdmin && <VenueEditor value={editing} busy={busy} onChange={setEditing} onClose={() => setEditing(null)} onSave={() => void save()} />}
    </main>
  );
}

function VenueEditor({ value, busy, onChange, onClose, onSave }: { value: FormState; busy: boolean; onChange: (v: FormState) => void; onClose: () => void; onSave: () => void }) {
  const set = (key: keyof FormState, next: string | number | boolean | null) => onChange({ ...value, [key]: next } as FormState);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-primary/35 bg-background p-5 shadow-[0_35px_100px_-45px_var(--color-primary)] sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/70">ADMIN // VENUE MATRIX</p><h2 className="mt-1 font-display text-2xl tracking-wider">{value.id ? "Upravit sportoviště" : "Nové sportoviště"}</h2></div><button onClick={onClose} className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{([['name','Název'],['city','Město'],['address','Adresa'],['sports','Sporty'],['hours','Otevírací doba'],['phone','Telefon'],['booking_url','URL rezervace'],['map_url','URL mapy'],['latitude','Latitude'],['longitude','Longitude'],['sort_order','Pořadí'],['note','Popisek']] as const).map(([key,label]) => <label key={key} className={key === 'note' ? 'sm:col-span-2' : ''}><span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span><input value={(value[key] ?? '') as any} onChange={(e) => set(key, ['latitude','longitude','sort_order'].includes(key) ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} className="mt-1 w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/55" /></label>)}</div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={value.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} /> Aktivní sportoviště</label><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground">Zrušit</button><button disabled={busy} onClick={onSave} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? 'Ukládám…' : 'Uložit změny'}</button></div></div></div>;
}
