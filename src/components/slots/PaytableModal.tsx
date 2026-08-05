import { motion } from "framer-motion";
import { X } from "lucide-react";
import { PAYLINE_NAMES, PAYLINES, SLOT_SYMBOLS, SYMBOL_ORDER } from "@/lib/slots";
import { SlotSymbol } from "./SlotSymbol";

export function PaytableModal({ bet, onClose }: { bet: number; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-2 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl slot-frame p-4 sm:p-6"
        initial={{ y: 40, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-[0.16em] slot-gold-text">PAYTABLE</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-hop-neon/70">
              Výhry zleva doprava · sázka {bet} Kč
            </p>
          </div>
          <button onClick={onClose} aria-label="Zavřít" className="rounded-lg border border-hop-gold/30 p-2 text-hop-gold">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {SYMBOL_ORDER.map((k) => {
            const def = SLOT_SYMBOLS[k];
            return (
              <div key={k} className="flex items-center gap-3 rounded-xl border border-hop-gold/20 bg-hop-950/70 p-2">
                <div className="h-12 w-12 shrink-0">
                  <SlotSymbol symbol={k} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground/90">{def.label}</p>
                  {def.wild ? (
                    <p className="text-[11px] text-hop-neon">Nahrazuje všechny symboly kromě Scatteru.</p>
                  ) : (
                    <p className="font-mono text-[11px] text-hop-gold/90">
                      3× {def.pays[0]}x · 4× {def.pays[1]}x · 5× {def.pays[2]}x
                      {def.scatter ? " (kdekoli, spouští Free Spiny)" : ""}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="mt-5 font-display text-sm tracking-[0.18em] slot-gold-text">VÝHERNÍ LINIE</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PAYLINES.map((p, i) => (
            <div key={i} className="rounded-xl border border-hop-gold/20 bg-hop-950/70 p-2">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-hop-neon/80">
                {i + 1}. {PAYLINE_NAMES[i]}
              </p>
              <div className="grid grid-cols-5 gap-0.5">
                {[0, 1, 2].map((row) =>
                  p.map((r, reel) => (
                    <div
                      key={`${row}-${reel}`}
                      className={`h-2 rounded-sm ${r === row ? "bg-hop-gold" : "bg-hop-800/70"}`}
                    />
                  )),
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
