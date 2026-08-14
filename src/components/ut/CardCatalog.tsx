import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CatalogCard = { id: string; name: string; rating: number; position: string; nation: string; club: string; league: string; rarity: string; card_type: string; campaign: string | null; pac: number; sho: number; pas: number; dri: number; def: number; phy: number };

export function CardCatalog() {
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [rarity, setRarity] = useState("ALL");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<"rating" | "name">("rating");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [{ data: catalog, error: catalogError }, { data: authData }] = await Promise.all([
        supabase.from("fc_cards").select("id,name,rating,position,nation,club,league,rarity,card_type,campaign,pac,sho,pas,dri,def,phy").order("rating", { ascending: false }).order("name", { ascending: true }),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (catalogError) { setError(catalogError.message); setLoading(false); return; }
      setCards((catalog ?? []) as CatalogCard[]);
      if (authData.user) {
        const { data: rows } = await supabase.from("fc_user_cards").select("card_id").eq("user_id", authData.user.id);
        if (!cancelled) setOwned(new Set((rows ?? []).map((row) => String(row.card_id))));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const positions = useMemo(() => ["ALL", ...Array.from(new Set(cards.map((c) => c.position))).sort()], [cards]);
  const rarities = useMemo(() => ["ALL", ...Array.from(new Set(cards.map((c) => c.rarity))).sort()], [cards]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (position !== "ALL" && card.position !== position) return false;
      if (rarity !== "ALL" && card.rarity !== rarity) return false;
      if (card.rating < minRating) return false;
      if (!q) return true;
      return [card.name, card.club, card.nation, card.league, card.position, card.rarity].some((v) => v.toLowerCase().includes(q));
    }).sort((a, b) => sort === "rating" ? (b.rating - a.rating) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  }, [cards, minRating, position, rarity, search, sort]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/20 bg-background/45 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Ultimate Team · Card Database</p><h2 className="mt-1 font-display text-2xl uppercase tracking-[0.08em]">Katalog všech karet</h2><p className="mt-1 text-xs text-muted-foreground">Kompletní přehled karet, které lze v Ultimate Teamu získat.</p></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{filtered.length} / {cards.length}</div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat hráče, klub, národ, ligu…" className="w-full rounded-xl border border-border/60 bg-background/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary/60" /></label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 font-mono text-xs uppercase tracking-widest"><option value="ALL">Všechny pozice</option>{positions.slice(1).map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 font-mono text-xs uppercase tracking-widest"><option value="ALL">Všechny rarity</option>{rarities.slice(1).map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 font-mono text-xs uppercase tracking-widest"><option value="rating">Rating</option><option value="name">Jméno</option></select>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2"><SlidersHorizontal className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Min. OVR</span><input type="range" min={0} max={99} step={1} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="flex-1 accent-[var(--color-primary)]" /><span className="w-8 text-right font-mono text-xs text-primary">{minRating || "ALL"}</span></div>
      </div>
      {error && <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">Katalog se nepodařilo načíst: {error}</div>}
      {loading ? <div className="rounded-2xl border border-border/60 bg-background/40 p-8 text-center text-sm text-muted-foreground">Načítám katalog karet…</div> : (
        <div className="overflow-hidden rounded-3xl border border-primary/15 bg-background/40">
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="border-b border-primary/15 bg-primary/5"><tr className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{['Karta','OVR','Pozice','Klub','Liga','Národ','Rarita','PAC','SHO','PAS','DRI','DEF','PHY','Stav'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-primary/10">{filtered.map((card) => { const isOwned = owned.has(card.id); return <tr key={card.id} className={cn("transition hover:bg-primary/5", isOwned && "bg-accent/[0.035]")}><td className="px-3 py-3"><div className="font-semibold text-foreground">{card.name}</div><div className="text-[10px] text-muted-foreground">{card.card_type}{card.campaign ? ` · ${card.campaign}` : ""}</div></td><td className="px-3 py-3 font-display text-lg text-primary">{card.rating}</td><td className="px-3 py-3 font-mono text-xs">{card.position}</td><td className="px-3 py-3 text-xs">{card.club}</td><td className="px-3 py-3 text-xs text-muted-foreground">{card.league}</td><td className="px-3 py-3 text-xs">{card.nation}</td><td className="px-3 py-3 text-[10px] font-bold uppercase text-accent">{card.rarity}</td>{[card.pac,card.sho,card.pas,card.dri,card.def,card.phy].map((v,i)=><td key={i} className="px-3 py-3 font-mono text-xs">{v}</td>)}<td className="px-3 py-3"><span className={cn("inline-flex rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest", isOwned ? "border-accent/40 bg-accent/10 text-accent" : "border-border/60 text-muted-foreground")}>{isOwned ? "VLASTNÍM" : "NEVLASTNÍM"}</span></td></tr>; })}</tbody></table></div>
          {!filtered.length && <div className="p-8 text-center text-sm text-muted-foreground">Žádná karta neodpovídá filtrům.</div>}
        </div>
      )}
    </div>
  );
}
