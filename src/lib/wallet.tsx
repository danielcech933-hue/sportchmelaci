import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

type RpcWallet = { balance?: number; slot_czk?: number } | null;

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("insufficient_balance")) return "Nedostatek dolarů na účtu.";
  if (message.includes("insufficient_slot")) return "Nedostatek Slot CZK v automatu.";
  if (message.includes("daily_bonus_cooldown")) return "Další kolo štěstí bude dostupné později.";
  if (message.includes("invalid_daily_bonus")) return "Tato výhra kola štěstí není platná.";
  if (message.includes("invalid_exchange")) return "Neplatná částka směny.";
  if (message.includes("invalid_slot_bet")) return "Neplatná sázka.";
  if (message.includes("invalid_slot_win")) return "Neplatná výhra.";
  if (message.includes("not_authenticated")) return "Pro tuto operaci se musíš přihlásit.";
  return "Operace se nepovedla. Zkus to znovu.";
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

    if (user) {
      // Auth is the source of truth for logged-in users.
      setSlotBalance(Math.max(0, Number(profileSlotCZK ?? SEED_SLOT)));
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
    const op = ++operationRef.current;

    if (!user) {
      const nextBalance = userDollars + deltaDollars;
      const nextSlot = slotBalance + deltaSlot;
      if (nextBalance < 0) return { ok: false, error: "Nedostatek dolarů na účtu." };
      if (nextSlot < 0) return { ok: false, error: "Nedostatek Slot CZK v automatu." };
      setSlotBalance(nextSlot);
      return { ok: true, balance: nextBalance, slot: nextSlot };
    }

    const { data, error } = await supabase.rpc("wallet_apply", {
      _delta_dollars: deltaDollars,
      _delta_slot_czk: deltaSlot,
      _reason: reason,
    });

    if (error) {
      return { ok: false, error: errorMessage(error) };
    }

    const result = data as RpcWallet;
    const nextSlot = Number(result?.slot_czk);

    // The RPC is authoritative. Ignore stale responses from an older request.
    if (op === operationRef.current && Number.isFinite(nextSlot)) {
      setSlotBalance(Math.max(0, nextSlot));
    }

    // Balance, slot CZK and avatar are refreshed together from the same profile row.
    await refreshProfile();

    return {
      ok: true,
      balance: Number(result?.balance ?? 0),
      slot: Number.isFinite(nextSlot) ? nextSlot : 0,
    };
  }, [refreshProfile, slotBalance, user, userDollars]);

  const exchangeToSlot = useCallback<WalletState["exchangeToSlot"]>(async (dollars) => {
    const amount = Math.floor(dollars);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
    if (amount > userDollars) return { ok: false, error: "Nedostatek dolarů na účtu." };

    const res = await apply(-amount, amount * EXCHANGE_RATE, "exchange_to_slot");
    return res.ok
      ? { ok: true, gained: amount * EXCHANGE_RATE }
      : { ok: false, error: res.error };
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

    // Keep the UI responsive, then let the RPC confirm the authoritative value.
    setSlotBalance((current) => Math.max(0, current - amount));

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
    if (!Number.isFinite(amount) || ![5, 10, 20, 50].includes(amount)) {
      return { ok: false, error: "Neplatná výhra kola štěstí." };
    }

    const res = await apply(amount, 0, "daily_bonus");
    return res.ok ? { ok: true, gained: amount } : { ok: false, error: res.error };
  }, [apply]);

  const value = useMemo<WalletState>(() => ({
    userDollars,
    slotCZK,
    ready,
    exchangeToSlot,
    exchangeToDollars,
    betSlot,
    winSlot,
    addDollars,
  }), [userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot, addDollars]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
