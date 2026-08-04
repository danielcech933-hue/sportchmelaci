import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client"; // Uprav cestu dle svého Supabase klienta
import { useAuth } from "@/hooks/useAuth"; // Nebo tvůj Custom Hook pro přihlášeného uživatele

interface SymbolConfig {
  id: string;
  label: string;
  icon: string;
  value: number;
  isWild?: boolean;
  isScatter?: boolean;
}

const SYMBOLS: SymbolConfig[] = [
  { id: "trophy", label: "Trofej", icon: "🏆", value: 50, isScatter: true },
  { id: "ball", label: "Míč", icon: "⚽", value: 25 },
  { id: "shirt", label: "Dres", icon: "👕", value: 15 },
  { id: "boots", label: "Kopačky", icon: "👟", value: 10 },
  { id: "whistle", label: "Píšťalka", icon: "📣", value: 5 },
  { id: "wild", label: "WILD", icon: "🃏", value: 0, isWild: true },
];

export const FootballSlotGame: React.FC = () => {
  const { user } = useAuth(); // Získání ID přihlášeného uživatele
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [bet, setBet] = useState<number>(10);
  const [reels, setReels] = useState<SymbolConfig[]>([SYMBOLS[1], SYMBOLS[0], SYMBOLS[1]]);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [freeSpins, setFreeSpins] = useState<number>(0);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  // 1. načtení aktuálního zůstatku z databáze (z tabulky profiles / wallets)
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase.from("profiles").select("balance").eq("id", user.id).single();

        if (error) throw error;
        if (data) setBalance(data.balance ?? 0);
      } catch (err) {
        console.error("Chyba při načítání zůstatku:", err);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [user]);

  // 2. Pomocná funkce pro zápis nového zůstatku do DB
  const syncBalanceToDb = async (newBalance: number) => {
    setBalance(newBalance);
    if (!user) return;

    try {
      const { error } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

      if (error) throw error;
    } catch (err) {
      console.error("Chyba při ukládání zůstatku:", err);
    }
  };

  const spin = async () => {
    if (spinning || loadingBalance) return;

    // Kontrola kreditů při běžném zatočení
    if (freeSpins === 0 && balance < bet) {
      setWinMessage("⚠️ Nedostatek kreditů!");
      return;
    }

    let currentBalance = balance;

    // Stržení sázky před točením
    if (freeSpins === 0) {
      currentBalance -= bet;
      await syncBalanceToDb(currentBalance);
    } else {
      setFreeSpins((prev) => prev - 1);
    }

    setSpinning(true);
    setWinMessage(null);

    // Animace točení válců
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
    }, 70);

    setTimeout(() => {
      clearInterval(interval);
      const finalReels = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ];
      setReels(finalReels);
      setSpinning(false);
      evaluateWin(finalReels, currentBalance);
    }, 1500);
  };

  const evaluateWin = async (results: SymbolConfig[], baseBalance: number) => {
    const scatters = results.filter((s) => s.isScatter).length;
    let updatedBalance = baseBalance;

    // 3 Scatter symboly = Free Spiny
    if (scatters === 3) {
      setFreeSpins((prev) => prev + 10);
      setWinMessage("🎉 10 FREE SPINŮ ZÍSKÁNO!");
      return;
    }

    // Vyhodnocení výherní linie
    const nonWilds = results.filter((s) => !s.isWild);
    const isWin = nonWilds.every((val, i, arr) => val.id === arr[0].id);

    if (isWin && nonWilds.length > 0) {
      const winSymbol = nonWilds[0];
      const winAmount = winSymbol.value * bet;
      updatedBalance += winAmount;
      setWinMessage(`🔥 VÝHRA ${winAmount} KREDITŮ! (${winSymbol.label})`);
      await syncBalanceToDb(updatedBalance);
    } else if (results.every((s) => s.isWild)) {
      const winAmount = 100 * bet;
      updatedBalance += winAmount;
      setWinMessage(`🃏 WILD JACKPOT! +${winAmount}`);
      await syncBalanceToDb(updatedBalance);
    } else {
      setWinMessage(freeSpins > 0 ? "Volné zatočení..." : null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-emerald-950 text-white rounded-3xl shadow-2xl max-w-md mx-auto border-4 border-amber-400/80">
      <div className="text-center mb-4">
        <h2 className="text-3xl font-black text-amber-400 uppercase tracking-wider drop-shadow-md">
          FOOTBALL SYNOT SLOT
        </h2>
        <p className="text-xs text-emerald-300 font-semibold uppercase">Turnajová edice • Propojeno s profilem</p>
      </div>

      <div className="flex justify-between w-full px-4 py-2 bg-emerald-900/80 rounded-xl mb-4 text-sm font-bold border border-emerald-700">
        <span className="text-amber-300">Zůstatek: {loadingBalance ? "Načítám..." : `${balance} bodů`}</span>
        {freeSpins > 0 && <span className="text-yellow-400 animate-pulse">Free Spiny: {freeSpins}</span>}
      </div>

      <div className="flex gap-3 my-2 bg-slate-900 p-4 rounded-2xl border-4 border-amber-500 shadow-inner">
        {reels.map((symbol, idx) => (
          <div
            key={idx}
            className={`w-20 h-28 bg-gradient-to-b from-slate-800 to-slate-950 rounded-xl flex flex-col items-center justify-center border-2 border-amber-500/50 shadow-md ${
              spinning ? "animate-pulse scale-95" : "scale-100 transition-all"
            }`}
          >
            <span className="text-4xl drop-shadow">{symbol.icon}</span>
            <span className="text-[10px] uppercase font-bold text-amber-200 mt-1">{symbol.label}</span>
          </div>
        ))}
      </div>

      <div className="h-10 my-2 flex items-center justify-center text-center">
        {winMessage && (
          <span className="text-sm font-extrabold text-amber-300 animate-bounce bg-emerald-900/90 px-3 py-1 rounded-full border border-amber-400">
            {winMessage}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-2 bg-emerald-900 p-2 rounded-xl border border-emerald-700">
          <span className="text-xs text-slate-300 font-bold">Sázka:</span>
          <button
            onClick={() => setBet((b) => Math.max(5, b - 5))}
            disabled={spinning}
            className="px-2 py-1 bg-emerald-800 hover:bg-emerald-700 rounded font-bold cursor-pointer"
          >
            -
          </button>
          <span className="font-black text-amber-400 w-8 text-center">{bet}</span>
          <button
            onClick={() => setBet((b) => b + 5)}
            disabled={spinning}
            className="px-2 py-1 bg-emerald-800 hover:bg-emerald-700 rounded font-bold cursor-pointer"
          >
            +
          </button>
        </div>

        <button
          onClick={spin}
          disabled={spinning || loadingBalance}
          className="px-8 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-yellow-600 disabled:opacity-50 text-slate-950 font-black text-lg rounded-full shadow-lg transition-all transform active:scale-95 uppercase cursor-pointer"
        >
          {spinning ? "Točí se..." : freeSpins > 0 ? "FREE SPIN" : "ZATOČIT"}
        </button>
      </div>
    </div>
  );
};
