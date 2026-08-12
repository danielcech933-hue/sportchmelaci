import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const EXCHANGE_RATE = 100;
type WalletResult = { ok: boolean; error?: string; gained?: number };

export interface WalletState {
  userDollars: number;
  slotCZK: number;
  ready: boolean;
  exchangeToSlot: (dollars: number) => Promise<WalletResult>;
  exchangeToDollars: (czk: number) => Promise<WalletResult>;
  betSlot: (amount: number) => boolean;
  winSlot: (amount: number) => void;
  addDollars: (amount: number) => Promise<WalletResult>;
}

const Ctx = createContext<WalletState | undefined>(undefined);
const KEY = (scope: string) => `chmelovci-wallet-guest-v4:${scope}`;
const GUEST_BASE_DOLLARS = 100;
const SEED_SLOT = 10000;

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("insufficient_balance")) return "Nedostatek dolarů na účtu.";
  if (message.includes("insufficient_slot")) return "Nedostatek Slot CZK v automatu.";
  if (message.includes("daily_bonus_cooldown")) return "Další pokus bude dostupný později.";
  if (message.includes("not_authenticated")) return "Pro tuto operaci se musíš přihlásit.";
  return "Operace se nepovedla. Zkus to znovu.";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, balance, slotCZK: profileSlotCZK, loading, refreshProfile } = useAuth();
  const scope = user?.id ?? "guest";
  const [slotBalance, setSlotBalance] = useState(SEED_SLOT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    setReady(false);
    if (user) {
      setSlotBalance(Number(profileSlotCZK ?? SEED_SLOT));
    } else if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(KEY(scope));
        const parsed = raw ? JSON.parse(raw) as { slotCZK?: number } : null;
        setSlotBalance(typeof parsed?.slotCZK === "number" ? Math.max(0, parsed.slotCZK) : SEED_SLOT);
      } catch {
        setSlotBalance(SEED_SLOT);
      }
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
    if (!user) return { ok: true, balance: userDollars + deltaDollars, slot: slotBalance + deltaSlot };
    const { data, error } = await supabase.rpc("wallet_apply", {
      _delta_dollars: deltaDollars,
      _delta_slot_czk: deltaSlot,
      _reason: reason,
    });
    if (error) return { ok: false, error: errorMessage(error) };
    const result = data as { balance?: number; slot_czk?: number } | null;
    if (typeof result?.slot_czk === "number") setSlotBalance(result.slot_czk);
    await refreshProfile();
    return { ok: true, balance: Number(result?.balance ?? 0), slot: Number(result?.slot_czk ?? 0) };
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

  const betSlot = useCallback<WalletState["betSlot"]>((amount) => {
    if (!Number.isFinite(amount) || amount <= 0 || slotBalance < amount) return false;
    setSlotBalance((current) => current - amount);
    if (user) {
      void apply(0, -amount, "slot_bet").then((res) => {
        if (!res.ok) void refreshProfile();
      });
    }
    return true;
  }, [apply, refreshProfile, slotBalance, user]);

  const winSlot = useCallback<WalletState["winSlot"]>((amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSlotBalance((current) => current + amount);
    if (user) {
      void apply(0, amount, "slot_win").then((res) => {
        if (!res.ok) void refreshProfile();
      });
    }
  }, [apply, refreshProfile, user]);

  const addDollars = useCallback<WalletState["addDollars"]>(async (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Neplatná výhra." };
    const res = await apply(amount, 0, "daily_bonus");
    return res.ok ? { ok: true, gained: amount } : { ok: false, error: res.error };
  }, [apply]);

  const value = useMemo<WalletState>(() => ({
    userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot, addDollars,
  }), [userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot, addDollars]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
