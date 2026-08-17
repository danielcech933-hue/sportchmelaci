import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Check, ChevronRight, Clock3, Dices, Flame, Lock, PackageOpen, Plus, ShieldCheck, Sparkles, Swords, Trophy, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type InventoryItem = {
  id: string;
  case_id: string;
  company_name: string;
  ticker: string;
  sector: string;
  share_count: number;
  rarity: string;
  rarity_score: number;
  serial: string;
  created_at: string;
  battle_value: number;
};

type OpenBattle = {
  id: string;
  code: string;
  creator_id: string;
  creator_nickname: string;
  creator_value: number;
  item_count: number;
  created_at: string;
};

type BattleItem = InventoryItem & { item_index: number };
type BattleResult = {
  id: string;
  code: string;
  status: string;
  creator_id: string;
  creator_nickname: string;
  opponent_id: string | null;
  opponent_nickname: string | null;
  creator_value: number;
  opponent_value: number;
  winner_id: string | null;
  created_at: string;
  joined_at: string | null;
  finished_at: string | null;
  creator_items: BattleItem[];
  opponent_items: BattleItem[];
};

type Mode = "create" | "join";
type Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

const MAX_ITEMS = 5;
const MIN_RATIO = 0.85;
const MAX_RATIO = 1.15;
const RARITY_STYLES: Record<string, string> = {
  COMMON: "border-white/10 bg-white/[.03] text-white/60",
  UNCOMMON: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  RARE: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  EPIC: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  LEGENDARY: "border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-100",
  ULTRA: "border-violet-200/40 bg-violet-400/10 text-violet-100",
  MYTHIC: "border-rose-200/45 bg-rose-400/10 text-rose-100",
};

const rpc = ((supabase.rpc as unknown) as Rpc);

function formatValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(value);
}

function errorText(message: string) {
  const map: Record<string, string> = {
    invalid_item_count: "Vyber 1–5 položek.",
    invalid_inventory_item: "Některá položka už není v tvém inventáři.",
    item_locked: "Některá položka je už použitá v aktivním Rollu.",
    roll_value_mismatch: "Hodnota druhé strany je mimo povolený rozsah ±15 %.",
    battle_not_found: "Roll už neexistuje.",
    battle_not_open: "Tento Roll už někdo obsadil.",
    self_join: "Nemůžeš se připojit do vlastního Rollu.",
    cannot_cancel_battle: "Roll už nejde zrušit.",
  };
  return map[message] ?? message;
}

export function RollBattles() {
  const { user, loading, nickname } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [openBattles, setOpenBattles] = useState<OpenBattle[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>("create");
  const [selected, setSelected] = useState<string[]>([]);
  const [joinBattle, setJoinBattle] = useState<OpenBattle | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [filter, setFilter] = useState("");

  const loadInventory = useCallback(async () => {
    const { data, error } = await rpc("case_opening_stock_inventory_summary");
    if (error) throw error;
    setInventory((Array.isArray(data) ? data : []) as InventoryItem[]);
  }, []);

  const loadBattles = useCallback(async () => {
    const [{ data: openData, error: openError }, { data: historyData, error: historyError }] = await Promise.all([
      rpc("case_roll_list_open"),
      rpc("case_roll_history"),
    ]);
    if (openError) throw openError;
    if (historyError) throw historyError;
    setOpenBattles((Array.isArray(openData) ? openData : []) as OpenBattle[]);
    setHistory((Array.isArray(historyData) ? historyData : []) as any[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const run = async () => {
      try {
        setLoadingData(true);
        await Promise.all([loadInventory(), loadBattles()]);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Nepodařilo se načíst Roll.");
      } finally {
        if (mounted) setLoadingData(false);
      }
    };
    void run();
    const interval = window.setInterval(() => void loadBattles().catch(() => undefined), 4000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [loadBattles, loadInventory, user]);

  const filteredInventory = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((item) =>
      `${item.company_name} ${item.ticker} ${item.rarity} ${item.sector}`.toLowerCase().includes(q),
    );
  }, [filter, inventory]);

  const selectedItems = useMemo(
    () => selected.map((id) => inventory.find((item) => item.id === id)).filter(Boolean) as InventoryItem[],
    [inventory, selected],
  );
  const selectedValue = useMemo(() => selectedItems.reduce((sum, item) => sum + Number(item.battle_value), 0), [selectedItems]);
  const targetValue = joinBattle ? Number(joinBattle.creator_value) : selectedValue;
  const minValue = targetValue * MIN_RATIO;
  const maxValue = targetValue * MAX_RATIO;
  const ratio = targetValue > 0 ? selectedValue / targetValue : 0;
  const withinRange = !joinBattle || (selectedValue >= minValue && selectedValue <= maxValue);

  const selectBattle = (battle: OpenBattle) => {
    setJoinBattle(battle);
    setMode("join");
    setSelected([]);
    setResult(null);
  };

  const clearJoin = () => {
    setJoinBattle(null);
    setMode("create");
    setSelected([]);
  };

  const toggleItem = (item: InventoryItem) => {
    if (busy || rolling) return;
    setResult(null);
    setSelected((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= MAX_ITEMS) {
        toast.error(`Maximálně ${MAX_ITEMS} akciových předmětů.`);
        return current;
      }
      return [...current, item.id];
    });
  };

  const createBattle = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      const { data, error } = await rpc("case_roll_create", { _inventory_ids: selected });
      if (error) throw error;
      setSelected([]);
      await loadInventory();
      await loadBattles();
      toast.success("Roll vytvořen — čeká na soupeře.");
    } catch (error) {
      toast.error(errorText(error instanceof Error ? error.message : "roll_create_failed"));
    } finally {
      setBusy(false);
    }
  };

  const joinAndRoll = async () => {
    if (!joinBattle || !selected.length || !withinRange || busy) return;
    setBusy(true);
    try {
      const { data, error } = await rpc("case_roll_join", { _battle_id: joinBattle.id, _inventory_ids: selected });
      if (error) throw error;
      const payload = data as BattleResult;
      setBusy(false);
      setRolling(true);
      window.setTimeout(() => {
        setResult(payload);
        setRolling(false);
        setJoinBattle(null);
        setMode("create");
        setSelected([]);
        void loadInventory();
        void loadBattles();
      }, 2500);
    } catch (error) {
      toast.error(errorText(error instanceof Error ? error.message : "roll_join_failed"));
      setBusy(false);
    }
  };

  const cancelBattle = async (battle: OpenBattle) => {
    setBusy(true);
    try {
      const { error } = await rpc("case_roll_cancel", { _battle_id: battle.id });
      if (error) throw error;
      await loadInventory();
      await loadBattles();
      toast.success("Roll zrušen.");
    } catch (error) {
      toast.error(errorText(error instanceof Error ? error.message : "cannot_cancel_battle"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const selectedCount = selectedItems.length;
  const canCreate = mode === "create" && selectedCount > 0 && !busy;
  const canJoin = mode === "join" && selectedCount > 0 && withinRange && !busy;
  const activeLabel = mode === "join" ? "VYBER SVŮJ STACK PRO SOUPEŘE" : "VYBER SVŮJ BATTLE STACK";

  return (
    <main className="min-h-screen bg-[#02050a] pb-28 text-white">
      <div className="mx-auto max-w-[1500px] px-3 pt-5 sm:px-5 lg:pt-8">
        <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(91,219,255,.13),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(255,77,150,.13),transparent_26%),linear-gradient(180deg,#07111a,#03060b)] p-4 sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[.34em] text-cyan-200/75">
                <Swords className="h-4 w-4" /> VIRTUAL STOCK ROLL BATTLES · PLAY MONEY
              </div>
              <h1 className="mt-2 font-display text-4xl tracking-[.13em] sm:text-6xl">ROLL</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">Naházej své akciové collectible dropy do stacku, drž hodnotu v podobné výši jako soupeř a vyzvi ho na serverově řízený Roll. Vítěz bere celý stack.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/games/case-opening" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/55 hover:text-white"><ArrowLeftRight className="h-3.5 w-3.5" /> CASE OPENING</Link>
                <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-cyan-200"><ShieldCheck className="h-3.5 w-3.5" /> SERVER LOCKED</div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-100"><Flame className="h-3.5 w-3.5" /> ±15 % MATCH WINDOW</div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl lg:min-w-[265px]">
              <div className="font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/35">PLAYER</div>
              <div className="mt-1 font-display text-2xl tracking-[.08em]">{nickname}</div>
              <div className="mt-1 text-xs text-white/40">{inventory.length} collectible drops available</div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-[28px] border border-white/10 bg-[#071018] p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="font-mono text-[8px] font-black uppercase tracking-[.28em] text-white/35">YOUR VAULT</div>
                <h2 className="mt-1 font-display text-2xl tracking-[.1em]">{activeLabel}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setFilter(""); setMode("create"); setJoinBattle(null); setSelected([]); }} className={cn("rounded-xl border px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.17em]", mode === "create" ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-black/25 text-white/45")}>CREATE</button>
                <button type="button" onClick={() => { setMode("join"); setSelected([]); }} className={cn("rounded-xl border px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.17em]", mode === "join" ? "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100" : "border-white/10 bg-black/25 text-white/45")}>JOIN</button>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Hledat ticker / firmu" className="w-44 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none placeholder:text-white/20" />
              </div>
            </div>

            {joinBattle && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/[.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-fuchsia-200/70">JOINING · {joinBattle.code}</div>
                  <div className="mt-1 text-xs text-white/55">{joinBattle.creator_nickname} · target {formatValue(targetValue)}</div>
                </div>
                <button type="button" onClick={clearJoin} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white"><X className="h-3.5 w-3.5" /> Zrušit výběr</button>
              </div>
            )}

            {loadingData ? (
              <div className="grid min-h-64 place-items-center text-sm text-white/35">Načítám vault…</div>
            ) : filteredInventory.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredInventory.map((item) => {
                  const isSelected = selected.includes(item.id);
                  const activeBattle = openBattles.some((battle) => battle.creator_id === user.id && battle.id === item.id);
                  return (
                    <motion.button key={item.id} type="button" onClick={() => toggleItem(item)} whileHover={{ y: -2 }} whileTap={{ scale: .985 }} className={cn("relative overflow-hidden rounded-2xl border p-3 text-left transition", isSelected ? "border-cyan-300/50 bg-cyan-300/[.08] shadow-[0_0_45px_-25px_rgba(91,219,255,.85)]" : "border-white/10 bg-black/20 hover:border-white/20", activeBattle && "opacity-60")}>
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        {isSelected && <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-300 text-black"><Check className="h-3.5 w-3.5" /></span>}
                        {activeBattle && <Lock className="h-3.5 w-3.5 text-white/30" />}
                      </div>
                      <div className="flex items-start justify-between gap-2 pr-7">
                        <div className="min-w-0">
                          <div className="truncate font-display text-lg tracking-[.05em]">{item.ticker}</div>
                          <div className="truncate text-xs text-white/50">{item.company_name}</div>
                        </div>
                        <span className={cn("shrink-0 rounded-full border px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.14em]", RARITY_STYLES[item.rarity] ?? RARITY_STYLES.COMMON)}>{item.rarity}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <MiniStat label="SHARES" value={new Intl.NumberFormat("cs-CZ", { notation: "compact", maximumFractionDigits: 1 }).format(item.share_count)} />
                        <MiniStat label="BATTLE VALUE" value={formatValue(item.battle_value)} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-[.12em] text-white/25"><span>{item.sector}</span><span>{item.serial.slice(-8)}</span></div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/30">Ve vaultu zatím nejsou žádné collectible dropy.</div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-[#071018] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div className="font-mono text-[8px] font-black uppercase tracking-[.24em] text-white/35">STACK</div><div className="font-mono text-[8px] font-black text-white/35">{selectedCount}/{MAX_ITEMS}</div></div>
              <div className="mt-2 font-display text-3xl tracking-[.08em] text-cyan-100">{formatValue(selectedValue)}</div>
              <div className="mt-1 text-[10px] text-white/35">virtual battle value</div>
              {joinBattle && (
                <>
                  <div className="mt-4 flex items-center justify-between text-[8px] font-mono uppercase tracking-[.16em] text-white/40"><span>TARGET</span><span>{formatValue(targetValue)}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50"><div className={cn("h-full rounded-full transition-all", withinRange ? "bg-gradient-to-r from-cyan-300 to-emerald-300" : "bg-rose-400")} style={{ width: `${Math.min(100, Math.abs((selectedValue / Math.max(1, targetValue)) * 100))}%` }} /></div>
                  <div className="mt-2 text-[9px] text-white/35">Povolené: {formatValue(minValue)} – {formatValue(maxValue)}</div>
                  <div className={cn("mt-2 rounded-xl border px-3 py-2 text-[10px]", withinRange ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200" : "border-rose-300/20 bg-rose-300/5 text-rose-200")}>{withinRange ? "STACK JE V MATCH WINDOW" : "PŘIDEJ / ODEBER ITEMY PRO VYROVNÁNÍ"}</div>
                </>
              )}
              <div className="mt-4 space-y-2">
                {selectedItems.length ? selectedItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/25 px-3 py-2"><div className="min-w-0"><div className="truncate text-xs text-white/75">{item.ticker} · {item.rarity}</div><div className="font-mono text-[8px] text-white/25">{formatValue(item.battle_value)}</div></div><button type="button" onClick={() => toggleItem(item)} className="rounded-lg p-1.5 text-white/25 hover:bg-white/5 hover:text-white/70"><X className="h-3.5 w-3.5" /></button></div>) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/25">Vyber položky z vaultu.</div>}
              </div>
              <button type="button" disabled={!(canCreate || canJoin)} onClick={() => void (mode === "join" ? joinAndRoll() : createBattle())} className={cn("mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[9px] font-black uppercase tracking-[.2em] transition", mode === "join" ? "bg-gradient-to-b from-fuchsia-200 to-fuchsia-500 text-black shadow-[0_0_40px_-12px_rgba(232,121,249,.95)]" : "bg-gradient-to-b from-cyan-200 to-cyan-500 text-black shadow-[0_0_40px_-12px_rgba(91,219,255,.95)]", "disabled:cursor-not-allowed disabled:opacity-30")}>
                {mode === "join" ? <><Dices className="h-4 w-4" /> JOIN & ROLL</> : <><Plus className="h-4 w-4" /> CREATE ROLL</>}
              </button>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#071018] p-4 sm:p-5">
              <div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/35"><Clock3 className="h-4 w-4" /> OPEN ROLLS</div>
              <div className="mt-3 space-y-2">
                {openBattles.length ? openBattles.map((battle) => (
                  <div key={battle.id} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2"><div><div className="font-display text-sm tracking-[.06em]">{battle.creator_nickname}</div><div className="font-mono text-[7px] uppercase tracking-[.15em] text-white/25">{battle.code} · {battle.item_count} itemů</div></div><div className="text-right"><div className="font-display text-sm text-cyan-100">{formatValue(battle.creator_value)}</div><div className="text-[7px] uppercase tracking-[.13em] text-white/25">VALUE</div></div></div>
                    <button type="button" onClick={() => selectBattle(battle)} disabled={busy || rolling} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-300/5 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-fuchsia-100 hover:bg-fuchsia-300/10 disabled:opacity-30">CHALLENGE <ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                )) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/25">Žádné otevřené battle rooms.</div>}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#071018] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/35">BATTLE HISTORY</div><h2 className="mt-1 font-display text-2xl tracking-[.08em]">RECENT ROLLS</h2></div><Trophy className="h-5 w-5 text-amber-300/70" /></div>
          <div className="mt-4 overflow-x-auto"><div className="min-w-[720px] space-y-2">{history.length ? history.map((item) => <div key={item.id} className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2"><div><div className="font-mono text-[8px] text-white/65">{item.code}</div><div className="text-[9px] text-white/30">{item.creator_nickname} vs {item.opponent_nickname ?? "—"}</div></div><div className="font-mono text-[8px] text-white/40">{formatValue(item.creator_value)}</div><div className="font-mono text-[8px] text-white/40">{formatValue(item.opponent_value)}</div><div className={cn("rounded-full border px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.13em]", item.status === "finished" ? (item.user_won ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-rose-300/25 bg-rose-300/10 text-rose-200") : "border-white/10 bg-white/[.02] text-white/35")}>{item.status === "finished" ? item.user_won ? "WIN" : "LOSS" : "CANCELLED"}</div></div>) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/25">Zatím žádná historie.</div>}</div></div>
        </section>
      </div>

      <AnimatePresence>
        {rolling && (
          <motion.div className="fixed inset-0 z-[12000] grid place-items-center bg-black/85 px-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(91,219,255,.12),transparent_28%),#071018] p-4 shadow-[0_0_140px_-30px_rgba(91,219,255,.6)] sm:p-7">
              <div className="text-center"><div className="font-mono text-[8px] font-black uppercase tracking-[.36em] text-cyan-200/60">SERVER RESOLUTION</div><div className="mt-2 font-display text-3xl tracking-[.13em] sm:text-5xl">ROLLING…</div></div>
              <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6"><BattleStrip label="PLAYER A" items={result?.creator_items ?? selectedItems as BattleItem[]} spinning /><div className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/40 font-display text-xl">VS</div><BattleStrip label="PLAYER B" items={result?.opponent_items ?? []} spinning /></div>
              <div className="mt-7 text-center font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/30">Items are locked · winner is resolved server-side</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && !rolling && (
          <motion.div className="fixed inset-0 z-[12100] grid place-items-center bg-black/85 px-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResult(null)}>
            <motion.div initial={{ scale: .82, y: 28 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl rounded-[34px] border border-amber-300/35 bg-[radial-gradient(circle_at_50%_0%,rgba(255,204,68,.16),transparent_32%),#071018] p-4 shadow-[0_0_160px_-35px_rgba(255,204,68,.72)] sm:p-7">
              <div className="text-center"><div className="font-mono text-[8px] font-black uppercase tracking-[.38em] text-amber-200/70">BATTLE FINISHED · {result.code}</div><div className="mt-2 font-display text-4xl tracking-[.1em] sm:text-6xl">{result.winner_id === user.id ? "YOU WIN" : "YOU LOSE"}</div><div className="mt-2 text-sm text-white/45">Vítěz bere celý stack. Poražené položky byly přesunuty serverem.</div></div>
              <div className="mt-7 grid gap-3 md:grid-cols-2"><ResultSide title={result.creator_nickname} value={result.creator_value} items={result.creator_items} winner={result.winner_id === result.creator_id} /><ResultSide title={result.opponent_nickname ?? "Opponent"} value={result.opponent_value} items={result.opponent_items} winner={result.winner_id === result.opponent_id} /></div>
              <button type="button" onClick={() => setResult(null)} className="mx-auto mt-5 flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-white/55 hover:text-white"><Sparkles className="h-4 w-4" /> Zavřít</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/20 px-2.5 py-2"><div className="font-mono text-[7px] font-black uppercase tracking-[.14em] text-white/25">{label}</div><div className="mt-0.5 font-mono text-[9px] font-black text-white/70">{value}</div></div>;
}

function BattleStrip({ label, items, spinning }: { label: string; items: BattleItem[] | InventoryItem[]; spinning?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/30">{label}</div><div className="mt-2 space-y-1.5">{items.slice(0,5).map((item, index) => <motion.div key={`${item.id}-${index}`} animate={spinning ? { x: [0, 7, -7, 0], opacity: [0.55, 1, .55] } : {}} transition={{ duration: .55, repeat: spinning ? Infinity : 0, delay: index * .06 }} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[.025] px-2.5 py-2"><span className="font-mono text-[8px] font-black text-white/65">{item.ticker}</span><span className="font-mono text-[8px] text-white/30">{formatValue(item.battle_value)}</span></motion.div>)}</div></div>;
}

function ResultSide({ title, value, items, winner }: { title: string; value: number; items: BattleItem[]; winner: boolean }) {
  return <div className={cn("rounded-2xl border p-4", winner ? "border-emerald-300/30 bg-emerald-300/[.04]" : "border-white/10 bg-black/20")}><div className="flex items-start justify-between gap-3"><div><div className="font-display text-xl tracking-[.06em]">{title}</div><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/30">Stack · {formatValue(value)}</div></div>{winner && <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase text-emerald-200"><Trophy className="h-3 w-3" /> WINNER</div>}</div><div className="mt-4 grid gap-1.5">{items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-2.5 py-2"><div><span className="font-mono text-[8px] font-black text-white/65">{item.ticker}</span><span className="ml-2 text-[8px] text-white/25">{item.rarity}</span></div><span className="font-mono text-[8px] text-white/35">{formatValue(item.battle_value)}</span></div>)}</div></div>;
}
