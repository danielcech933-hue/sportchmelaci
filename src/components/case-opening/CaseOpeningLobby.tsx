import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeDollarSign, Boxes, Cpu, Factory, Gamepad2, Globe2, History, LockKeyhole, PackageOpen, Sparkles, Zap } from "lucide-react";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type CaseId = "tech" | "ai" | "finance" | "energy" | "gaming" | "mobility" | "industrial" | "global" | "quantum" | "omega";
type StockDrop = { case_id: CaseId; case_name: string; cost: number; company_name: string; ticker: string; sector: string; share_count: number; rarity: string; rarity_score: number; serial: string; balance: number; virtual_only: boolean };
type HistoryRow = { id: string; case_id: CaseId; case_cost: number; company_name: string; ticker: string; sector: string; share_count: number; rarity: string; rarity_score: number; serial: string; created_at: string };
type InventoryRow = Omit<HistoryRow, "id" | "case_cost">;

type CaseConfig = { id: CaseId; name: string; sector: string; cost: number; description: string; accent: string; icon: typeof Boxes };

const PRIVILEGED = new Set(["danko", "chlaďar", "chladar", "midas", "m1das"]);
const CASES: CaseConfig[] = [
  { id: "tech", name: "TECHNOLOGY VAULT", sector: "Technology", cost: 10_000_000_000, description: "Semiconductors, cloud, robotics and future infrastructure.", accent: "cyan", icon: Cpu },
  { id: "ai", name: "AI / CLOUD BLACKBOX", sector: "AI & Cloud", cost: 25_000_000_000, description: "Frontier models, AI compute and cloud empires.", accent: "violet", icon: Zap },
  { id: "finance", name: "FINANCE DYNASTY", sector: "Finance", cost: 50_000_000_000, description: "Banks, exchanges, payments and market infrastructure.", accent: "emerald", icon: BadgeDollarSign },
  { id: "energy", name: "ENERGY FRONTIER", sector: "Energy", cost: 75_000_000_000, description: "Fusion, renewables, grid storage and advanced materials.", accent: "amber", icon: Zap },
  { id: "gaming", name: "GAMING & MEDIA", sector: "Gaming & Media", cost: 100_000_000_000, description: "Game studios, streaming, media tech and digital worlds.", accent: "pink", icon: Gamepad2 },
  { id: "mobility", name: "MOBILITY TITANS", sector: "Mobility", cost: 125_000_000_000, description: "Autonomy, EV systems, aerospace mobility and logistics.", accent: "orange", icon: Globe2 },
  { id: "industrial", name: "INDUSTRIAL CORE", sector: "Industry", cost: 150_000_000_000, description: "Robotics, aerospace and advanced manufacturing.", accent: "slate", icon: Factory },
  { id: "global", name: "GLOBAL GIANTS", sector: "Global", cost: 250_000_000_000, description: "Cross-sector pool with boosted high-tier odds.", accent: "gold", icon: Globe2 },
  { id: "quantum", name: "QUANTUM FRONTIER", sector: "Quantum", cost: 500_000_000_000, description: "Quantum compute, photonics and frontier science.", accent: "fuchsia", icon: Cpu },
  { id: "omega", name: "OMEGA BLACK RESERVE", sector: "Omega", cost: 1_000_000_000_000, description: "The deepest case: rarest companies and microscopic lots.", accent: "gold", icon: PackageOpen },
];

const FILTERS = ["All", "Technology", "AI & Cloud", "Finance", "Energy", "Gaming & Media", "Mobility", "Quantum"];
const RARITY_STYLES: Record<string, string> = {
  COMMON: "text-white/65 border-white/10 bg-white/[.03]",
  UNCOMMON: "text-emerald-200 border-emerald-300/25 bg-emerald-300/10",
  RARE: "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
  EPIC: "text-amber-200 border-amber-300/30 bg-amber-300/10",
  LEGENDARY: "text-fuchsia-200 border-fuchsia-300/30 bg-fuchsia-400/15",
  ULTRA: "text-violet-100 border-violet-200/40 bg-violet-400/15",
  MYTHIC: "text-white border-white/30 bg-white/10 shadow-[0_0_35px_rgba(255,255,255,.15)]",
};

const dollars = (value: number) => `${Math.round(value).toLocaleString("en-US")} $`;
const shares = (value: number) => `${Math.round(value).toLocaleString("en-US")} SHARES`;

export function CaseOpeningLobby() {
  const { user, nickname, balance, loading } = useAuth();
  const allowed = PRIVILEGED.has((nickname ?? "").trim().toLocaleLowerCase("cs-CZ"));
  const [cash, setCash] = useState(Number(balance ?? 0));
  const [filter, setFilter] = useState("All");
  const [opening, setOpening] = useState<CaseId | null>(null);
  const [drop, setDrop] = useState<StockDrop | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  useEffect(() => setCash(Number(balance ?? 0)), [balance]);

  const loadData = useCallback(async () => {
    if (!user || !allowed) return;
    const [{ data: hist }, { data: inv }] = await Promise.all([
      supabase.from("case_opening_stock_history").select("id,case_id,case_cost,company_name,ticker,sector,share_count,rarity,rarity_score,serial,created_at").order("created_at", { ascending: false }).limit(12),
      supabase.rpc("case_opening_stock_inventory_summary"),
    ]);
    setHistory((hist ?? []) as HistoryRow[]);
    // The RPC returns the inventory as a JSON array. Do not unwrap the first item,
    // otherwise the client treats a single row as the entire response and renders an empty vault.
    const parsed = Array.isArray(inv) ? inv : (inv ?? []);
    setInventory(Array.isArray(parsed) ? (parsed as InventoryRow[]) : []);
  }, [allowed, user]);

  useEffect(() => { void loadData(); }, [loadData]);

  const visibleCases = useMemo(() => filter === "All" ? CASES : CASES.filter((item) => item.sector === filter), [filter]);
  const currentCase = CASES.find((item) => item.id === opening) ?? null;

  if (loading) return null;
  if (!user || !allowed) return <Navigate to="/" replace />;

  const openCase = async (caseId: CaseId) => {
    if (opening) return;
    const cfg = CASES.find((item) => item.id === caseId);
    if (!cfg) return;
    if (cash < cfg.cost) { toast.error("Nemáš dostatek betting dolarů."); return; }
    setOpening(caseId);
    setDrop(null);
    const { data, error } = await supabase.rpc("case_opening_stock_open", { _case_id: caseId });
    if (error) {
      setOpening(null);
      toast.error(error.message.includes("case_opening_forbidden") ? "Case Opening je pouze pro autorizované hráče." : error.message);
      return;
    }
    const next = (Array.isArray(data) ? data[0] : data) as StockDrop;
    window.setTimeout(() => {
      setDrop(next);
      setCash(Number(next.balance));
      setOpening(null);
      void loadData();
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-[#02060b] pb-28 text-white">
      <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-5 lg:pt-10">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(83,193,255,.14),transparent_28%),radial-gradient(circle_at_84%_8%,rgba(211,99,255,.12),transparent_26%),linear-gradient(180deg,#09131d,#02060b)] p-4 shadow-[0_50px_150px_-70px_rgba(60,180,255,.5)] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] [background-size:30px_30px]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[.32em] text-cyan-200/75"><PackageOpen className="h-4 w-4" /> PRIVATE MARKET DROP LOUNGE</div>
              <h1 className="mt-2 font-display text-4xl tracking-[.13em] sm:text-6xl">CASE OPENING</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">Otevírej virtuální investment cases za betting dolary. Získáváš unikátní digitální share collectibles od fiktivních společností; nejde o skutečné akcie ani skutečné cenné papíry.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-emerald-200"><LockKeyhole className="h-3.5 w-3.5" /> PRIVATE ACCESS</span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-200">10B $ MINIMUM</span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/55"><BadgeDollarSign className="h-3.5 w-3.5" /> BETTING BANKROLL</span>
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-4 lg:min-w-[280px]">
              <div className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-cyan-200/55">PLAYER BANKROLL</div>
              <div className="mt-1 font-display text-2xl tracking-[.07em]">{dollars(cash)}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/40"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> {nickname} · VIRTUAL ECONOMY</div>
            </div>
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={cn("shrink-0 rounded-xl border px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.16em] transition", filter === item ? "border-cyan-200/45 bg-cyan-200/10 text-cyan-100" : "border-white/10 bg-white/[.02] text-white/40 hover:text-white/70")}>{item}</button>)}
        </div>

        <section className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleCases.map((cfg) => {
            const Icon = cfg.icon;
            const busy = opening === cfg.id;
            return <motion.article key={cfg.id} whileHover={{ y: -5 }} className={cn("relative overflow-hidden rounded-[28px] border bg-[#071018] p-4 shadow-2xl", cfg.accent === "cyan" ? "border-cyan-300/25" : cfg.accent === "violet" ? "border-violet-300/25" : cfg.accent === "gold" ? "border-amber-300/30" : "border-white/10")}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.08),transparent_35%)]" />
              <div className="relative flex items-center justify-between gap-3"><div className="rounded-xl border border-white/10 bg-black/30 p-2.5"><Icon className="h-5 w-5 text-white/85" /></div><span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/45">{cfg.sector}</span></div>
              <div className="relative mt-4 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(0,0,0,.18))] p-5">
                <div className="font-mono text-[8px] font-black uppercase tracking-[.3em] text-white/30">CASE {CASES.findIndex((x) => x.id === cfg.id) + 1} / 10</div>
                <div className="mt-2 font-display text-2xl tracking-[.08em]">{cfg.name}</div>
                <p className="mt-2 min-h-10 text-xs leading-relaxed text-white/40">{cfg.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><Stat label="ENTRY" value={dollars(cfg.cost)} /><Stat label="POOL" value="50+ companies" /></div>
              </div>
              <button type="button" onClick={() => void openCase(cfg.id)} disabled={Boolean(opening) || cash < cfg.cost} className="relative mt-4 w-full rounded-xl border border-cyan-200/30 bg-cyan-200/10 px-4 py-3 font-mono text-[9px] font-black uppercase tracking-[.18em] text-cyan-100 transition hover:bg-cyan-200/15 disabled:cursor-not-allowed disabled:opacity-25">{busy ? "REVEALING DROP…" : `OPEN FOR ${dollars(cfg.cost)}`}</button>
            </motion.article>;
          })}
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-[26px] border border-white/10 bg-[#071018] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.28em] text-white/35">COLLECTIBLE INVENTORY</div><h2 className="mt-1 font-display text-2xl tracking-[.09em]">YOUR SHARE VAULT</h2></div><div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.15em] text-white/45">{inventory.length} / 100</div></div>
            {inventory.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{inventory.slice(0,12).map((row) => <InventoryCard key={row.serial} row={row} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/30">Vault je zatím prázdný. Otevři první case.</div>}
          </div>
          <div className="rounded-[26px] border border-white/10 bg-[#071018] p-4 sm:p-5"><div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/35"><History className="h-4 w-4" /> RECENT DROPS</div><div className="mt-3 space-y-2">{history.length ? history.map((row) => <div key={row.id} className="rounded-xl border border-white/8 bg-black/25 px-3 py-2"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-semibold text-white/75">{row.company_name}</div><div className="font-mono text-[7px] uppercase tracking-[.14em] text-white/30">{row.ticker} · {row.share_count.toLocaleString("en-US")} shares</div></div><span className={cn("rounded-full border px-2 py-0.5 font-mono text-[7px] font-black", RARITY_STYLES[row.rarity] ?? RARITY_STYLES.COMMON)}>{row.rarity}</span></div></div>) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/30">Zatím žádné drops.</div>}</div></div>
        </section>
      </div>

      <AnimatePresence>{opening && currentCase && <motion.div className="fixed inset-0 z-[11000] grid place-items-center bg-black/80 px-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="w-full max-w-lg rounded-[30px] border border-cyan-300/25 bg-[#081018] p-8 text-center shadow-[0_0_120px_rgba(83,193,255,.16)]"><motion.div animate={{ rotate: [0, -2, 2, 0], scale: [1, 1.04, 1] }} transition={{ duration: .7, repeat: Infinity }} className="mx-auto grid h-28 w-28 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-200/5"><Boxes className="h-14 w-14 text-cyan-200" /></motion.div><div className="mt-5 font-mono text-[9px] font-black uppercase tracking-[.3em] text-cyan-200/65">{currentCase.name}</div><div className="mt-2 font-display text-3xl tracking-[.1em]">ALLOCATING DIGITAL EQUITY…</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5"><motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.35, ease: "easeInOut" }} /></div></div></motion.div>}</AnimatePresence>

      <AnimatePresence>{drop && <motion.div className="fixed inset-0 z-[11100] grid place-items-center bg-black/80 px-4 backdrop-blur-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrop(null)}><motion.div initial={{ scale: .75, y: 30 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-2xl rounded-[32px] border border-cyan-200/30 bg-[radial-gradient(circle_at_50%_0%,rgba(83,193,255,.14),transparent_38%),#081018] p-7 text-center shadow-[0_0_150px_rgba(83,193,255,.2)]" onClick={(e) => e.stopPropagation()}>
          <div className="font-mono text-[9px] font-black uppercase tracking-[.34em] text-cyan-200/55">CASE REVEALED · VIRTUAL COLLECTIBLE</div>
          <div className="mt-3 font-display text-4xl tracking-[.1em] sm:text-5xl">{drop.company_name}</div>
          <div className="mt-2 font-mono text-sm font-black tracking-[.22em] text-white/45">{drop.ticker} · {drop.sector}</div>
          <div className="mt-6 grid grid-cols-2 gap-3"><RevealStat label="SHARE LOT" value={shares(drop.share_count)} /><RevealStat label="RARITY SCORE" value={String(drop.rarity_score)} /></div>
          <div className={cn("mx-auto mt-5 inline-flex rounded-full border px-4 py-2 font-mono text-[9px] font-black uppercase tracking-[.23em]", RARITY_STYLES[drop.rarity] ?? RARITY_STYLES.COMMON)}>{drop.rarity}</div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/30">SERIAL</div><div className="mt-1 font-mono text-sm font-black tracking-[.18em] text-white/70">{drop.serial}</div></div>
          <p className="mt-5 text-xs leading-relaxed text-white/35">Vzácnost = kombinace rarity společnosti a velikosti share lotu. Čím vzácnější společnost a menší počet akcií, tím vyšší tier. Jedná se pouze o virtuální herní collectible.</p>
          <button type="button" onClick={() => setDrop(null)} className="mt-6 rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-5 py-3 font-mono text-[9px] font-black uppercase tracking-[.18em] text-cyan-100">ADD TO VAULT</button>
        </motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2"><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/30">{label}</div><div className="mt-1 text-xs font-semibold text-white/70">{value}</div></div>; }
function RevealStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/30">{label}</div><div className="mt-1 font-display text-lg tracking-[.06em] text-white/80">{value}</div></div>; }
function InventoryCard({ row }: { row: InventoryRow }) { return <div className="rounded-2xl border border-white/8 bg-black/25 p-3"><div className="flex items-center justify-between gap-2"><span className={cn("rounded-full border px-2 py-0.5 font-mono text-[7px] font-black", RARITY_STYLES[row.rarity] ?? RARITY_STYLES.COMMON)}>{row.rarity}</span><span className="font-mono text-[7px] text-white/25">{row.ticker}</span></div><div className="mt-3 font-display text-lg tracking-[.05em]">{row.company_name}</div><div className="mt-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/35">{shares(row.share_count)}</div><div className="mt-3 font-mono text-[7px] tracking-[.14em] text-white/25">{row.serial}</div></div>; }
