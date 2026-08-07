import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** Kurz směnárny: 1 Dollar = 100 Slot CZK */
export const EXCHANGE_RATE = 100;

export interface WalletState {
  /** Sportovní ekonomika (dolary) — základ z databáze + lokální herní zisky/směny. */
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
  /** Připsání dolarů (např. denní kolo štěstí). */
  addDollars: (amount: number) => void;
}

const Ctx = createContext<WalletState | undefined>(undefined);

const KEY = (scope: string) => `chmelovci-wallet-v2:${scope}`;
const GUEST_BASE_DOLLARS = 100;
const SEED_SLOT = 10000;

/** Perzistujeme jen deltu dolarů (základ drží databáze) a herní kredity. */
type Persisted = { dollarDelta: number; slotCZK: number };

function readStore(scope: string): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (typeof parsed.dollarDelta !== "number" || typeof parsed.slotCZK !== "number") return null;
    return { dollarDelta: parsed.dollarDelta, slotCZK: parsed.slotCZK };
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, balance, loading } = useAuth();
  const scope = user?.id ?? "guest";

  const [dollarDelta, setDollarDelta] = useState(0);
  const [slotCZK, setSlotCZK] = useState(0);
  const [ready, setReady] = useState(false);

  /* Načtení / inicializace peněženky pro aktuální účet. Perzistuje přes navigaci i refresh. */
  useEffect(() => {
    if (loading) return;
    setReady(false);
    const stored = readStore(scope);
    setDollarDelta(stored?.dollarDelta ?? 0);
    setSlotCZK(stored?.slotCZK ?? SEED_SLOT);
    setReady(true);
  }, [scope, loading]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(KEY(scope), JSON.stringify({ dollarDelta, slotCZK } satisfies Persisted));
  }, [ready, scope, dollarDelta, slotCZK]);

  const baseDollars = user ? Number(balance ?? 0) : GUEST_BASE_DOLLARS;
  const userDollars = Math.max(0, baseDollars + dollarDelta);

  const exchangeToSlot = useCallback<WalletState["exchangeToSlot"]>(
    (dollars) => {
      const amount = Math.floor(dollars);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Zadej platnou částku." };
      if (amount > userDollars) return { ok: false, error: "Nedostatek dolarů na účtu." };
      const gained = amount * EXCHANGE_RATE;
      setDollarDelta((d) => d - amount);
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
      setDollarDelta((d) => d + gained);
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

  const addDollars = useCallback<WalletState["addDollars"]>((amount) => {
    if (amount > 0) setDollarDelta((d) => d + amount);
  }, []);

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
