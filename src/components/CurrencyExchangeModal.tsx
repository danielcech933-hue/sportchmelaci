import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Coins, X } from "lucide-react";
import { toast } from "sonner";
import { EXCHANGE_RATE, useWallet } from "@/lib/wallet";

/** Směnárna: 1 Dollar = 100 Slot CZK, s validací proti přečerpání. */
export function CurrencyExchangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userDollars, slotCZK, exchangeToSlot, exchangeToDollars } = useWallet();
  const [dir, setDir] = useState<"toSlot" | "toDollars">("toSlot");
  const [amount, setAmount] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const numeric = Number(amount);
  const preview =
    dir === "toSlot"
      ? `${(Number.isFinite(numeric) ? Math.floor(numeric) : 0) * EXCHANGE_RATE} Slot CZK`
      : `$${Number.isFinite(numeric) ? Math.floor(Math.floor(numeric) / EXCHANGE_RATE) : 0}`;

  function submit() {
    const res = dir === "toSlot" ? exchangeToSlot(numeric) : exchangeToDollars(numeric);
    if (!res.ok) {
      setError(res.error ?? "Směna se nepovedla.");
      toast.error(res.error ?? "Směna se nepovedla.");
      return;
    }
    setError(null);
    toast.success(
      dir === "toSlot"
        ? `Úspěšně převedeno — +${res.gained} Slot CZK`
        : `Úspěšně převedeno — +$${res.gained}`,
    );
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-hop-gold/40 bg-black/85 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-hop-neon/80">Směnárna</p>
                <h2 className="font-display text-2xl tracking-[0.1em] slot-gold-text">KURZ 1 : {EXCHANGE_RATE}</h2>
              </div>
              <button onClick={onClose} aria-label="Zavřít" className="rounded-lg border border-hop-gold/30 p-1.5 text-hop-gold">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-300/80">Dolary</p>
                <p className="font-display text-lg font-black tabular-nums text-emerald-200">${userDollars.toFixed(0)}</p>
              </div>
              <div className="rounded-xl border border-hop-gold/30 bg-hop-gold/10 px-2 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-hop-neon/80">Slot CZK</p>
                <p className="font-display text-lg font-black tabular-nums text-hop-gold">{slotCZK.toLocaleString("cs-CZ")}</p>
              </div>
            </div>

            <button
              onClick={() => { setDir((d) => (d === "toSlot" ? "toDollars" : "toSlot")); setError(null); }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-hop-gold/30 bg-hop-950/70 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-hop-gold"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {dir === "toSlot" ? "Dolary → Slot CZK" : "Slot CZK → Dolary"}
            </button>

            <label className="mt-3 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hop-neon/70">
                Částka ({dir === "toSlot" ? "$" : "Slot CZK"})
              </span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                className="mt-1 w-full rounded-xl border border-hop-gold/30 bg-hop-950/80 px-3 py-2 font-mono text-lg text-foreground outline-none focus:border-hop-gold"
              />
            </label>

            <p className="mt-2 font-mono text-xs text-hop-neon/80">Obdržíš: {preview}</p>
            {error && (
              <p className="mt-2 rounded-lg border border-rose-400/50 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-hop-gold/70 bg-gradient-to-b from-hop-gold via-amber-500 to-hop-gold-deep px-4 py-3 font-display text-sm font-black uppercase tracking-[0.16em] text-hop-950"
            >
              <Coins className="h-4 w-4" /> Směnit
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
