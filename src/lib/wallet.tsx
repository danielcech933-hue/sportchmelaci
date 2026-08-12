import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const EXCHANGE_RATE = 100;
type WalletResult = { ok: boolean; error?: string; gained?: number };
type DailyBonusResult = { ok: boolean; error?: string; prize?: number; segmentIndex?: number; nextClaimAt?: string };
type DailyBonusStatus = { ok: boolean; error?: string; nextClaimAt?: string | null };

type SlotSpinRpc = {
  grid: string[][];
  line_wins: unknown[];
  scatter_count: number;
  scatter_amount: number;
  scatter_cells: [number, number][];
  total: number;
  multiplier_of_bet: number;
  free_spins_triggered: boolean;
  bonus_options: Array<{ spins: number; mult: number }>;
  free_spins_left: number;
  bonus_total: number;
  bonus_done: boolean;
  slot_czk: number;
};

export interface WalletState {
  userDollars: number;
  slotCZK: number;
  ready: boolean;
  exchangeToSlot: (dollars: number) => Promise<WalletResult>;
  exchangeToDollars: (czk: number) => Promise<WalletResult>;
  spinSlot: (bet: number) => Promise<{ ok: boolean; error?: string; result?: SlotSpinRpc }>;
  pickBonus: (multiplier: number) => Promise<WalletResult>;
  claimDailyBonus: () => Promise<DailyBonusResult>;
  dailyBonusStatus: () => Promise<DailyBonusStatus>;
}

const Ctx = createContext<WalletState | undefined>(undefined);
const KEY = (scope: string) => `chmelovci-wallet-guest-v4:${scope}`;
const GUEST_BASE_DOLLARS = 100;
const SEED_SLOT = 10000;

type RpcWallet = { balance?: number | string; slot_czk?: number | string } | null;

type DailyBonusRpc = {
  prize?: number | string;
  amount?: number | string;
  reward?: number | string;
  dollars?: number | string;
  balance?: number | string;
  segment_index?: number | string;
  segmentIndex?: number | string;
  next_claim_at?: string | null;
  nextClaimAt?: string | null;
} | null;

type DailyBonusStatusRpc = { next_claim_at?: string | null; nextClaimAt?: string | null; can_claim?: boolean } | null;

function normalizeRpcJson<T>(data: unknown): T | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try { return JSON.parse(data) as T; } catch { return null; }
  }
  if (Array.isArray(data)) return (data[0] ?? null) as T | null;
  return data as T;
}

function findRpcValue(data: unknown, keys: string[]): unknown {
  if (data == null) return undefined;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRpcValue(item, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof data === "string") {
    try { return findRpcValue(JSON.parse(data), keys); } catch { return undefined; }
  }
  if (typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  for (const key of keys) if (key in record && record[key] != null) return record[key];
  for (const value of Object.values(record)) {
    const found = findRpcValue(value, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return mapDomainError(error.message);
  const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown } | null;
  const parts = [value?.message, value?.details, value?.hint]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  const code = typeof value?.code === "string" && value.code ? `[${value.code}] ` : "";
  const message = parts[0] ?? (typeof error === "string" ? error : "");
  return mapDomainError(`${code}${[message, ...parts.slice(1).filter((part) => part !== message)].join(" — ")}`.trim());
}

function mapDomainError(full: string): string {
  if (full.includes("insufficient_balance")) return "Nedostatek dolarů na účtu.";
  if (full.includes("insufficient_slot")) return "Nedostatek Slot CZK v automatu.";
  if (full.includes("daily_bonus_cooldown")) return "Další kolo štěstí bude dostupné později.";
  if (full.includes("invalid_daily_bonus")) return "Tato výhra kola štěstí není platná.";
  if (full.includes("invalid_exchange")) return "Neplatná částka směny.";
  if (full.includes("invalid_slot_bet")) return "Neplatná sázka.";
  if (full.includes("bonus_pick_required")) return "Nejdřív vyber bonus.";
  if (full.includes("no_bonus_pick")) return "Bonus už není dostupný.";
  if (full.includes("invalid_bonus_pick")) return "Neplatná volba bonusu.";
  if (full.includes("invalid_free_spin_bet")) return "Free spin nepoužívá další sázku.";
  if (full.includes("bonus_bet_missing")) return "Bonus nelze spustit, protože chybí původní sázka.";
  if (full.includes("not_authenticated")) return "Pro tuto operaci se musíš přihlásit.";
  if (full.includes("no_profile")) return "Profil uživatele nebyl nalezen.";
  return full ? `Operace se nepovedla: ${full}` : "Operace se nepovedla. Zkus to znovu.";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, balance, slotCZK: profileSlotCZK, loading, refreshProfile } = useAuth();
  const scope = user?.id ?? "guest";
  const [slotBalance, setSlotBalance] = useState(SEED_SLOT);
  const [ready, setReady] = useState(false);
  const operationRef = useRef(0);

  useEffect(() => {
    if (loading) return;
    setReady(false);
    operationRef.current += 1;
    if (user) setSlotBalance(Math.max(0, Number(profileSlotCZK ?? SEED_SLOT)));
    else if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(KEY(scope));
        const parsed = raw ? JSON.parse(raw) as { slotCZK?: number } : null;
        setSlotBalance(typeof parsed?.slotCZK === "number" ? Math.max(0, parsed.slotCZK) : SEED_SLOT);
      } catch { setSlotBalance(SEED_SLOT); }
    }
    setReady(true);
  }, [scope, user, loading, profileSlotCZK]);

  useEffect(() => {
    if (!ready || user || typeof window === "undefined") return;
    window.localStorage.setItem(KEY(scope), JSON.stringify({ slotCZK: slotBalance }));
  }, [ready, scope, user, slotBalance]);

  const userDollars = user ? Number(balance ?? 0) : GUEST_BASE_DOLLARS;
  const slotCZK = slotBalance;

  const apply = useCallback(async (deltaDollars: number, deltaSlot: number, reason: string) => {
    const op = ++operationRef.current;
    if (!user) {
      const nextBalance = userDollars + deltaDollars;
      const nextSlot = slotBalance + deltaSlot;
      if (nextBalance < 0) return { ok: false, error: "Nedostatek dolarů na účtu." };
      if (nextSlot < 0) return { ok: false, error: "Nedostatek Slot CZK v automatu." };
      setSlotBalance(nextSlot);
      return { ok: true, balance: nextBalance, slot: nextSlot };
    }
    const { data, error } = await supabase.rpc("wallet_apply", { _delta_dollars: deltaDollars, _delta_slot_czk: deltaSlot, _reason: reason });
    if (error) return { ok: false, error: errorMessage(error) };
    const result = normalizeRpcJson<RpcWallet>(data);
    const nextSlot = Number(result?.slot_czk);
    if (op === operationRef.current && Number.isFinite(nextSlot)) setSlotBalance(Math.max(0, nextSlot));
    await refreshProfile();
    return { ok: true, balance: Number(result?.balance ?? 0), slot: Number.isFinite(nextSlot) ? nextSlot : 0 };
  }, [refreshProfile, slotBalance, user, userDollars]);

  const exchangeToSlot = useCallback<WalletState["exchangeToSlot"]>(async (dollars) => {
    const amount = Math.floor(dollars);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
    if (amount > userDollars) return { ok: false, error: "Nedostatek dolarů na účtu." };
    const res = await apply(-amount, amount * EXCHANGE_RATE, "exchange_to_slot");
    return res.ok ? { ok: true, gained: amount * EXCHANGE_RATE } : { ok: false, error: res.error };
  }, [apply, userDollars]);

  const exchangeToDollars = useCallback<WalletState["exchangeToDollars"]>(async (czk) => {
    const amount = Math.floor(czk);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
    if (amount % EXCHANGE_RATE !== 0) return { ok: false, error: `Směňuj po ${EXCHANGE_RATE} Slot CZK.` };
    if (amount > slotBalance) return { ok: false, error: "Nedostatek Slot CZK v automatu." };
    const gained = amount / EXCHANGE_RATE;
    const res = await apply(gained, -amount, "exchange_to_dollars");
    return res.ok ? { ok: true, gained } : { ok: false, error: res.error };
  }, [apply, slotBalance]);

  const spinSlot = useCallback<WalletState["spinSlot"]>(async (bet) => {
    const amount = Math.floor(bet);
    if (!user) return { ok: false, error: "Pro hraní automatu se musíš přihlásit." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Neplatná sázka." };
    const { data, error } = await supabase.rpc("slot_spin", { _bet: amount });
    if (error) return { ok: false, error: errorMessage(error) };
    const result = normalizeRpcJson<SlotSpinRpc>(data);
    if (!result || !Array.isArray(result.grid) || result.grid.length !== 5 || result.grid.some((col) => !Array.isArray(col) || col.length !== 3)) {
      return { ok: false, error: "Server vrátil neplatný výsledek automatu (očekáváno 5×3)." };
    }
    const nextSlot = Number(result.slot_czk);
    if (Number.isFinite(nextSlot)) setSlotBalance(Math.max(0, nextSlot));
    await refreshProfile();
    return { ok: true, result };
  }, [refreshProfile, user]);

  const pickBonus = useCallback<WalletState["pickBonus"]>(async (multiplier) => {
    if (!user) return { ok: false, error: "Pro bonus se musíš přihlásit." };
    const { error } = await supabase.rpc("slot_pick_bonus", { _multiplier: multiplier });
    if (error) return { ok: false, error: errorMessage(error) };
    await refreshProfile();
    return { ok: true };
  }, [refreshProfile, user]);

  const claimDailyBonus = useCallback<WalletState["claimDailyBonus"]>(async () => {
    if (!user) return { ok: false, error: "Pro kolo štěstí se musíš přihlásit." };
    const { data, error } = await supabase.rpc("daily_bonus_claim");
    if (error) return { ok: false, error: errorMessage(error) };
    const rpc = normalizeRpcJson<DailyBonusRpc>(data);
    const prize = Number(findRpcValue(rpc, ["prize", "amount", "reward", "dollars"]));
    if (![5, 10, 20, 50].includes(prize)) return { ok: false, error: "Server vrátil neplatnou výhru kola štěstí." };
    const segmentIndexValue = findRpcValue(rpc, ["segment_index", "segmentIndex"]);
    const segmentIndex = Number(segmentIndexValue);
    const nextClaimValue = findRpcValue(rpc, ["next_claim_at", "nextClaimAt"]);
    await refreshProfile();
    return {
      ok: true,
      prize,
      segmentIndex: Number.isInteger(segmentIndex) && segmentIndex >= 0 && segmentIndex < 8 ? segmentIndex : undefined,
      nextClaimAt: typeof nextClaimValue === "string" ? nextClaimValue : undefined,
    };
  }, [refreshProfile, user]);

  const dailyBonusStatus = useCallback<WalletState["dailyBonusStatus"]>(async () => {
    if (!user) return { ok: false, error: "Pro kolo štěstí se musíš přihlásit." };
    const { data, error } = await supabase.rpc("daily_bonus_status");
    if (error) return { ok: false, error: errorMessage(error) };
    const nextClaimValue = findRpcValue(data, ["next_claim_at", "nextClaimAt"]);
    return { ok: true, nextClaimAt: typeof nextClaimValue === "string" ? nextClaimValue : null };
  }, [user]);

  const value = useMemo<WalletState>(() => ({ userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, spinSlot, pickBonus, claimDailyBonus, dailyBonusStatus }), [userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, spinSlot, pickBonus, claimDailyBonus, dailyBonusStatus]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
