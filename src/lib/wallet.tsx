import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

/** Kurz směnárny: 1 Dollar = 100 Slot CZK */
export const EXCHANGE_RATE = 100;

export interface WalletState {
  /** Autoritativní sportovní zůstatek z public.profiles.balance. */
  userDollars: number;
  /** Herní ekonomika automatu (Slot CZK). */
  slotCZK: number;
  ready: boolean;
  exchangeToSlot: (dollars: number) => { ok: boolean; error?: string; gained?: number };
  exchangeToDollars: (czk: number) => { ok: boolean; error?: string; gained?: number };
  betSlot: (amount: number) => boolean;
  winSlot: (amount: number) => void;
  addDollars: (amount: number) => void;
}

const Ctx = createContext<WalletState | undefined>(undefined);
const KEY = (scope: string) => `chmelovci-wallet-v3:${scope}`;
const GUEST_BASE_DOLLARS = 100;
const SEED_SLOT = 10000;
type Persisted = { slotCZK: number };

function readStore(scope: string): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return typeof parsed.slotCZK === "number" ? { slotCZK: Math.max(0, parsed.slotCZK) } : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("insufficient_balance")) return "Nedostatek dolarů na účtu.";
  if (message.includes("insufficient_slot")) return "Nedostatek Slot CZK v automatu.";
  if (message.includes("not_authenticated")) return "Pro tuto operaci se musíš přihlásit.";
  return "Operace se nepovedla. Zkus to znovu.";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, balance, loading, refreshProfile } = useAuth();
  const scope = user?.id ?? "guest";
  const [slotCZK, setSlotCZK] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    setReady(false);
    const stored = readStore(scope);
    setSlotCZK(stored?.slotCZK ?? SEED_SLOT);
    setReady(true);
  }, [scope, loading]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(KEY(scope), JSON.stringify({ slotCZK } satisfies Persisted));
  }, [ready, scope, slotCZK]);

  const userDollars = user ? Number(balance ?? 0) : GUEST_BASE_DOLLARS;

  const adjustDollars = useCallback(
    async (delta: number, reason: string): Promise<{ ok: boolean; balance?: number; error?: string }> => {
      if (!user) {
        if (delta < 0 && GUEST_BASE_DOLLARS + delta < 0) return { ok: false, error: "Nedostatek dolarů na účtu." };
        return { ok: true, balance: GUEST_BASE_DOLLARS + delta };
      }

      const { data, error } = await supabase.rpc("wallet_adjust_balance", {
        _delta: delta,
        _reason: reason,
      });
      if (error) return { ok: false, error: errorMessage(error) };
      await refreshProfile();
      return { ok: true, balance: Number(data ?? 0) };
    },
    [refreshProfile, user],
  );

  const exchangeToSlot = useCallback<WalletState["exchangeToSlot"]>(
    (dollars) => {
      const amount = Math.floor(dollars);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount > userDollars) return { ok: false, error: "Nedostatek dolarů na účtu." };

      // The public API is synchronous for compatibility with existing UI.
      // Start the authoritative DB operation and only mutate Slot CZK after it succeeds.
      void (async () => {
        const res = await adjustDollars(-amount, "exchange_to_slot");
        if (res.ok) setSlotCZK((c) => c + amount * EXCHANGE_RATE);
      })();
      return { ok: true, gained: amount * EXCHANGE_RATE };
    },
    [adjustDollars, userDollars],
  );

  const exchangeToDollars = useCallback<WalletState["exchangeToDollars"]>(
    (czk) => {
      const amount = Math.floor(czk);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount % EXCHANGE_RATE !== 0) return { ok: false, error: `Směňuj po ${EXCHANGE_RATE} Slot CZK.` };
      if (amount > slotCZK) return { ok: false, error: "Nedostatek Slot CZK v automatu." };

      void (async () => {
        const gained = amount / EXCHANGE_RATE;
        const res = await adjustDollars(gained, "exchange_to_dollars");
        if (res.ok) setSlotCZK((c) => Math.max(0, c - amount));
      })();
      return { ok: true, gained: amount / EXCHANGE_RATE };
    },
    [adjustDollars, slotCZK],
  );

  const betSlot = useCallback<WalletState["betSlot"]>(
    (amount) => {
      if (amount <= 0 || slotCZK < amount) return false;
      setSlotCZK((c) => c - amount);
      return true;
    },
    [slotCZK],
  );

  const winSlot = useCallback<WalletState["winSlot"]>((amount) => {
    if (amount > 0) setSlotCZK((c) => c + amount);
  }, []);

  const addDollars = useCallback<WalletState["addDollars"]>(
    (amount) => {
      if (amount <= 0) return;
      void adjustDollars(amount, "daily_bonus");
    },
    [adjustDollars],
  );

  const value = useMemo<WalletState>(
    () => ({ userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot, addDollars }),
    [userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot, addDollars],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
