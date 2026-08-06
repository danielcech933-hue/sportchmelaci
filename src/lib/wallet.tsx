import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** Kurz směnárny: 1 Dollar = 100 Slot CZK */
export const EXCHANGE_RATE = 100;

export interface WalletState {
  /** Sportovní ekonomika (dolary) */
  userDollars: number;
  /** Herní ekonomika automatu (Slot CZK) */
  slotCZK: number;
  ready: boolean;
  /** Směna dolarů na Slot CZK. Vrací chybu, pokud není dost prostředků. */
  exchangeToSlot: (dollars: number) => { ok: boolean; error?: string; gained?: number };
  /** Směna Slot CZK zpět na dolary. */
  exchangeToDollars: (czk: number) => { ok: boolean; error?: string; gained?: number };
  /** Odečet sázky z herní peněženky (bez možnosti jít do mínusu). */
  betSlot: (amount: number) => boolean;
  /** Připsání výhry do herní peněženky. */
  winSlot: (amount: number) => void;
}

const Ctx = createContext<WalletState | undefined>(undefined);

const KEY = (scope: string) => `chmelovci-wallet-v1:${scope}`;
const SEED_DOLLARS = 100;
const SEED_SLOT = 10000;

type Persisted = { userDollars: number; slotCZK: number };

function readStore(scope: string): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (typeof parsed.userDollars !== "number" || typeof parsed.slotCZK !== "number") return null;
    return { userDollars: parsed.userDollars, slotCZK: parsed.slotCZK };
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, balance, loading } = useAuth();
  const scope = user?.id ?? "guest";

  const [userDollars, setUserDollars] = useState(0);
  const [slotCZK, setSlotCZK] = useState(0);
  const [ready, setReady] = useState(false);

  /* Načtení / inicializace peněženky pro aktuální účet. Perzistuje přes navigaci i refresh. */
  useEffect(() => {
    if (loading) return;
    setReady(false);
    const stored = readStore(scope);
    if (stored) {
      setUserDollars(stored.userDollars);
      setSlotCZK(stored.slotCZK);
    } else {
      setUserDollars(user ? Number(balance ?? 0) : SEED_DOLLARS);
      setSlotCZK(SEED_SLOT);
    }
    setReady(true);
  }, [scope, loading, user, balance]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(KEY(scope), JSON.stringify({ userDollars, slotCZK } satisfies Persisted));
  }, [ready, scope, userDollars, slotCZK]);

  const exchangeToSlot = useCallback<WalletState["exchangeToSlot"]>(
    (dollars) => {
      const amount = Math.floor(dollars);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount > userDollars) return { ok: false, error: "Nedostatek dolarů na účtu." };
      const gained = amount * EXCHANGE_RATE;
      setUserDollars((d) => d - amount);
      setSlotCZK((c) => c + gained);
      return { ok: true, gained };
    },
    [userDollars],
  );

  const exchangeToDollars = useCallback<WalletState["exchangeToDollars"]>(
    (czk) => {
      const amount = Math.floor(czk);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount % EXCHANGE_RATE !== 0) return { ok: false, error: `Směňuj po ${EXCHANGE_RATE} Slot CZK.` };
      if (amount > slotCZK) return { ok: false, error: "Nedostatek Slot CZK v automatu." };
      const gained = amount / EXCHANGE_RATE;
      setSlotCZK((c) => c - amount);
      setUserDollars((d) => d + gained);
      return { ok: true, gained };
    },
    [slotCZK],
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

  const value = useMemo<WalletState>(
    () => ({ userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot }),
    [userDollars, slotCZK, ready, exchangeToSlot, exchangeToDollars, betSlot, winSlot],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
