import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

/** Kurz směnárny: 1 Dollar = 100 Slot CZK */
export const EXCHANGE_RATE = 100;

type WalletResult = { ok: boolean; error?: string; gained?: number };

export interface WalletState {
  /** Autoritativní sportovní zůstatek z public.profiles.balance. */
  userDollars: number;
  /** Herní ekonomika automatu (Slot CZK). */
  slotCZK: number;
  ready: boolean;
  exchangeToSlot: (dollars: number) => Promise<WalletResult>;
  exchangeToDollars: (czk: number) => Promise<WalletResult>;
  betSlot: (amount: number) => boolean;
  winSlot: (amount: number) => void;
  addDollars: (amount: number) => Promise<WalletResult>;
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
    async (delta: number, reason: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) {
        return delta >= 0 || GUEST_BASE_DOLLARS + delta >= 0
          ? { ok: true }
          : { ok: false, error: "Nedostatek dolarů na účtu." };
      }

      const { error } = await supabase.rpc("wallet_adjust_balance", {
        _delta: delta,
        _reason: reason,
      });
      if (error) return { ok: false, error: errorMessage(error) };
      await refreshProfile();
      return { ok: true };
    },
    [refreshProfile, user],
  );

  const exchangeToSlot = useCallback<WalletState["exchangeToSlot"]>(
    async (dollars) => {
      const amount = Math.floor(dollars);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount > userDollars) return { ok: false, error: "Nedostatek dolarů na účtu." };

      const res = await adjustDollars(-amount, "exchange_to_slot");
      if (!res.ok) return res;
      setSlotCZK((c) => c + amount * EXCHANGE_RATE);
      return { ok: true, gained: amount * EXCHANGE_RATE };
    },
    [adjustDollars, userDollars],
  );

  const exchangeToDollars = useCallback<WalletState["exchangeToDollars"]>(
    async (czk) => {
      const amount = Math.floor(czk);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount % EXCHANGE_RATE !== 0) return { ok: false, error: `Směňuj po ${EXCHANGE_RATE} Slot CZK.` };
      if (amount > slotCZK) return { ok: false, error: "Nedostatek Slot CZK v automatu." };

      const gained = amount / EXCHANGE_RATE;
      const res = await adjustDollars(gained, "exchange_to_dollars");
      if (!res.ok) return res;
      setSlotCZK((c) => Math.max(0, c - amount));
      return { ok: true, gained };
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
    async (amount) => {
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Neplatná výhra." };
      const res = await adjustDollars(amount, "daily_bonus");
      return res.ok ? { ok: true, gained: amount } : res;
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
