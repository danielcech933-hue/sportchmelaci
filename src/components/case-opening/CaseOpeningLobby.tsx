import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Crown, Gem, History, LockKeyhole, PackageOpen, Sparkles, Trophy, Zap } from "lucide-react";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

type CaseId = "starter" | "gold" | "mythic";
type Reward = { case_id: CaseId; cost: number; reward_czk: number; rarity: string; reward_label: string; slot_czk: number };
type HistoryRow = { id: string; case_id: CaseId; case_cost: number; reward_czk: number; rarity: string; reward_label: string; created_at: string };

const PRIVILEGED = new Set(["danko", "chlaďar", "chladar", "midas", "m1das"]);
const CASES: Array<{ id: CaseId; name: string; kicker: string; cost: number; glow: string; border: string; badge: string; rewards: string; icon: typeof Boxes }> = [
  { id: "starter", name: "CHMEL STARTER", kicker: "FIELD DROP", cost: 100, glow: "from-emerald-400/30 via-cyan-400/10 to-transparent", border: "border-emerald-300/25", badge: "COMMON", rewards: "75 → 1 000 CZK", icon: Boxes },
  { id: "gold", name: "GOLDEN VAULT", kicker: "PREMIUM DROP", cost: 500, glow: "from-amber-400/35 via-yellow-200/10 to-transparent", border: "border-amber-300/35", badge: "EPIC", rewards: "350 → 10 000 CZK", icon: Crown },
  { id: "mythic", name: "MYTHIC ASCENSION", kicker: "ULTRA DROP", cost: 2500, glow: "from-fuchsia-500/35 via-violet-500/10 to-transparent", border: "border-fuchsia-300/35", badge: "ULTRA", rewards: "1 500 → 100 000 CZK", icon: Gem },
];

const RARITY_STYLES: Record<string, string> = {
  COMMON: "text-white/70 border-white/10 bg-white/[.03]",
  UNCOMMON: "text-emerald-200 border-emerald-300/25 bg-emerald-300/10",
  RARE: "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
  EPIC: "text-amber-200 border-amber-300/30 bg-amber-300/10",
  LEGENDARY: "text-fuchsia-200 border-fuchsia-300/30 bg-fuchsia-400/15",
  ULTRA: "text-violet-100 border-violet-200/40 bg-violet-400/15",
};

export function CaseOpeningLobby() {
  const { user, nickname, loading } = useAuth();
  const { slotCZK } = useWallet();
  const allowed = PRIVILEGED.has((nickname ?? "").trim().toLocaleLowerCase("cs-CZ"));
  const [balance, setBalance] = useState(slotCZK);
  const [opening, setOpening] = useState<CaseId | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => setBalance(slotCZK), [slotCZK]);

  const loadHistory = useCallback(async () => {
    if (!user || !allowed) return;
    const { data } = await supabase.from("case_opening_history").select("id,case_id,case_cost,reward_czk,rarity,reward_label,created_at").order("created_at", { ascending: false }).limit(8);
    setHistory((data ?? []) as HistoryRow[]);
  }, [allowed, user]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const currentCase = useMemo(() => CASES.find((item) => item.id === opening) ?? null, [opening]);

  if (loading) return null;
  if (!user || !allowed) return <Navigate to="/" replace />;

  const openCase = async (caseId: CaseId) => {
    if (opening) return;
    const cfg = CASES.find((item) => item.id === caseId)!;
    if (balance < cfg.cost) { toast.error("Nemáš dostatek Slot CZK."); return; }
    setOpening(caseId);
    setReward(null);
    const { data, error } = await supabase.rpc("case_opening_open", { _case_id: caseId });
    if (error) {
      toast.error(error.message.includes("case_opening_forbidden") ? "Case Opening je jen pro autorizované hráče." : error.message);
      setOpening(null);
      return;
    }
    const next = (Array.isArray(data) ? data[0] : data) as Reward;
    window.setTimeout(() => {
      setReward(next);
      setBalance(Number(next.slot_czk));
      setOpening(null);
      void loadHistory();
      toast.success(`${next.rarity}: +${Number(next.reward_czk).toLocaleString("cs-CZ")} CZK`);
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-[#03070c] pb-28 text-white">
      <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-5 lg:pt-10">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_25%_0%,rgba(255,204,68,.13),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(160,90,255,.12),transparent_28%),linear-gradient(180deg,#081018,#03070c)] p-4 shadow-[0_45px_140px_-70px_rgba(255,204,68,.6)] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[.32em] text-amber-200/75"><PackageOpen className="h-4 w-4" /> PRIVILEGED GAME LOBBY</div>
              <h1 className="mt-2 font-display text-4xl tracking-[.14em] sm:text-6xl">CASE OPENING</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/48">Exkluzivní box-opening lobby pro Danko, Chlaďara a Midase. Otevři case, sleduj cinematic reveal a získej Slot CZK dropy přímo ze serverové RNG.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-emerald-200"><LockKeyhole className="h-3.5 w-3.5" /> PRIVATE ACCESS</div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/55">BALANCE · {Number(balance).toLocaleString("cs-CZ")} CZK</div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 lg:min-w-[240px]"><div className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-amber-200/60">PLAYER</div><div className="mt-1 font-display text-2xl tracking-[.08em]">{nickname}</div><div className="mt-1 flex items-center gap-2 text-xs text-white/40"><Sparkles className="h-3.5 w-3.5 text-amber-300" /> SERVER RNG · PLAY MONEY</div></div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          {CASES.map((cfg, index) => {
            const Icon = cfg.icon;
            const busy = opening === cfg.id;
            return <motion.article key={cfg.id} whileHover={{ y: -5 }} className={cn("relative overflow-hidden rounded-[26px] border bg-[#071018] p-4 shadow-2xl", cfg.border)}>
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", cfg.glow)} />
              <div className="relative flex items-center justify-between gap-3"><div className="rounded-xl border border-white/10 bg-black/30 p-2.5"><Icon className="h-5 w-5 text-white/85" /></div><span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/50">{cfg.badge}</span></div>
              <div className="relative mt-5 rounded-2xl border border-white/8 bg-black/25 p-5 text-center"><div className="font-mono text-[8px] font-black uppercase tracking-[.35em] text-white/30">{cfg.kicker}</div><div className="mt-3 text-7xl drop-shadow-[0_0_30px_rgba(255,255,255,.15)]">{index === 0 ? "📦" : index === 1 ? "💎" : "👑"}</div><div className="mt-3 font-display text-2xl tracking-[.08em]">{cfg.name}</div><div className="mt-2 text-xs text-white/40">Rewards · {cfg.rewards}</div></div>
              <div className="relative mt-4 flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] uppercase tracking-[.16em] text-white/35">OPEN COST</div><div className="font-display text-xl text-amber-200">{cfg.cost.toLocaleString("cs-CZ")} CZK</div></div><button type="button" onClick={() => void openCase(cfg.id)} disabled={Boolean(opening) || balance < cfg.cost} className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-[.17em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-30">{busy ? "OPENING…" : "OPEN CASE"}</button></div>
            </motion.article>;
          })}
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-[26px] border border-white/10 bg-[#071018] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.28em] text-white/35">OPENING ENGINE</div><h2 className="mt-1 font-display text-2xl tracking-[.09em]">DROP POOL</h2></div><div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[8px] font-black text-white/50"><Zap className="h-3.5 w-3.5 text-amber-300" /> SERVER AUTHORITATIVE</div></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Drop name="COMMON" chance="34–45%" tone="COMMON"/><Drop name="UNCOMMON" chance="29–32%" tone="UNCOMMON"/><Drop name="RARE" chance="13–21%" tone="RARE"/><Drop name="EPIC" chance="3–13%" tone="EPIC"/><Drop name="LEGENDARY / ULTRA" chance="0.5–7%" tone="LEGENDARY"/></div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-[#071018] p-4 sm:p-5"><div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/35"><History className="h-4 w-4" /> RECENT OPENINGS</div><div className="mt-3 space-y-2">{history.length ? history.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2"><div className="min-w-0"><div className="truncate text-xs text-white/70">{row.reward_label}</div><div className="font-mono text-[7px] uppercase tracking-[.14em] text-white/30">{row.case_id} · {new Date(row.created_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</div></div><div className="text-right"><div className={cn("inline-flex rounded-full border px-2 py-0.5 font-mono text-[7px] font-black", RARITY_STYLES[row.rarity] ?? RARITY_STYLES.COMMON)}>{row.rarity}</div><div className="mt-1 font-mono text-[9px] font-black text-amber-200">+{Number(row.reward_czk).toLocaleString("cs-CZ")}</div></div></div>) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/30">Zatím žádné otevřené case.</div>}</div></div>
        </section>
      </div>

      <AnimatePresence>{opening && currentCase && <motion.div className="fixed inset-0 z-[11000] grid place-items-center bg-black/75 px-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="w-full max-w-md rounded-[28px] border border-amber-300/35 bg-[#081018] p-7 text-center shadow-[0_0_100px_rgba(255,204,68,.2)]"><motion.div animate={{ rotate: [0, 2, -2, 0], scale: [1, 1.03, 1] }} transition={{ duration: .75, repeat: Infinity }} className="text-8xl">📦</motion.div><div className="mt-5 font-mono text-[9px] font-black uppercase tracking-[.3em] text-amber-200/65">{currentCase.name}</div><div className="mt-2 font-display text-2xl tracking-[.12em]">OPENING DROP…</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5"><motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-100 to-fuchsia-300" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.1, ease: "easeInOut" }} /></div></div></motion.div>}</AnimatePresence>

      <AnimatePresence>{reward && <motion.div className="fixed inset-0 z-[11100] grid place-items-center bg-black/80 px-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReward(null)}><motion.div initial={{ scale: .76, y: 30 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-xl rounded-[32px] border border-amber-300/40 bg-[radial-gradient(circle_at_50%_0%,rgba(255,204,68,.14),transparent_36%),#081018] p-7 text-center shadow-[0_0_130px_rgba(255,204,68,.18)]" onClick={(e) => e.stopPropagation()}><Trophy className="mx-auto h-10 w-10 text-amber-300"/><div className="mt-4 font-mono text-[9px] font-black uppercase tracking-[.34em] text-white/40">CASE REVEALED</div><div className="mt-2 font-display text-4xl tracking-[.12em] sm:text-5xl">{reward.reward_label}</div><div className={cn("mx-auto mt-4 inline-flex rounded-full border px-3 py-1 font-mono text-[9px] font-black uppercase tracking-[.2em]", RARITY_STYLES[reward.rarity] ?? RARITY_STYLES.COMMON)}>{reward.rarity}</div><div className="mt-5 font-display text-5xl text-amber-200">+{Number(reward.reward_czk).toLocaleString("cs-CZ")} CZK</div><div className="mt-6 text-xs text-white/35">Klikni kamkoliv mimo panel pro zavření.</div></motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}

function Drop({ name, chance, tone }: { name: string; chance: string; tone: string }) {
  return <div className={cn("rounded-xl border p-3", RARITY_STYLES[tone] ?? RARITY_STYLES.COMMON)}><div className="font-mono text-[8px] font-black uppercase tracking-[.14em]">{name}</div><div className="mt-1 text-[11px] opacity-70">{chance}</div></div>;
}
