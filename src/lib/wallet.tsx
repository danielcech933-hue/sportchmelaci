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
  betSlot: (amount: number) => Promise<boolean>;
  winSlot: (amount: number) => Promise<void>;
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
  const [guestSlotCZK, setGuestSlotCZK] = useState(SEED_SLOT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    setReady(false);
    if (!user && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(KEY(scope));
        const parsed = raw ? JSON.parse(raw) as { slotCZK?: number } : null;
        setGuestSlotCZK(typeof parsed?.slotCZK === "number" ? Math.max(0, parsed.slotCZK) : SEED_SLOT);
      } catch {
        setGuestSlotCZK(SEED_SLOT);
      }
    }
    setReady(true);
  }, [scope, user, loading]);

  useEffect(() => {
    if (!ready || user || typeof window === "undefined") return;
    window.localStorage.setItem(KEY(scope), JSON.stringify({ slotCZK: guestSlotCZK }));
  }, [ready, scope, user, guestSlotCZK]);

  const userDollars = user ? Number(balance ?? 0) : GUEST_BASE_DOLLARS;
  const slotCZK = user ? Number(profileSlotCZK ?? SEED_SLOT) : guestSlotCZK;

  const apply = useCallback(async (deltaDollars: number, deltaSlot: number, reason: string) => {
    if (!user) return { ok: true, balance: userDollars + deltaDollars, slot: slotCZK + deltaSlot };
    const { data, error } = await supabase.rpc("wallet_apply", {
      _delta_dollars: deltaDollars,
      _delta_slot_czk: deltaSlot,
      _reason: reason,
    });
    if (error) return { ok: false, error: errorMessage(error) };
    await refreshProfile();
    const result = data as { balance?: number; slot_czk?: number } | null;
    return { ok: true, balance: Number(result?.balance ?? 0), slot: Number(result?.slot_czk ?? 0) };
  }, [refreshProfile, slotCZK, user, userDollars]);

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
    if (amount > slotCZK) return { ok: false, error: "Nedostatek Slot CZK v automatu." };
    const gained = amount / EXCHANGE_RATE;
    const res = await apply(gained, -amount, "exchange_to_dollars");
    return res.ok ? { ok: true, gained } : { ok: false, error: res.error };
  }, [apply, slotCZK]);

  const betSlot = useCallback<WalletState["betSlot"]>(async (amount) => {
    if (!Number.isFinite(amount) || amount <= 0 || slotCZK < amount) return false;
    const res = await apply(0, -amount, "slot_bet");
    return res.ok;
  }, [apply, slotCZK]);

  const winSlot = useCallback<WalletState["winSlot"]>(async (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    await apply(0, amount, "slot_win");
  }, [apply]);

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
