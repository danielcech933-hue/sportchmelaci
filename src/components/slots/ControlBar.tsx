import { Info, Minus, Plus, Repeat, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { BETS, formatKc } from "@/lib/slots";

interface ControlBarProps {
  balance: number;
  bet: number;
  lastWin: number;
  spinning: boolean;
  freeSpinsLeft: number;
  autoLeft: number;
  onBet: (bet: number) => void;
  onMaxBet: () => void;
  onSpin: () => void;
  onAuto: (spins: number) => void;
  onStopAuto: () => void;
  onInfo: () => void;
  onHof: () => void;
}

const AUTO_OPTIONS = [10, 25, 50, 100];

export function ControlBar({
  balance,
  bet,
  lastWin,
  spinning,
  freeSpinsLeft,
  autoLeft,
  onBet,
  onMaxBet,
  onSpin,
  onAuto,
  onStopAuto,
  onInfo,
  onHof,
}: ControlBarProps) {
  const idx = BETS.indexOf(bet);
  const dec = () => onBet(BETS[Math.max(0, idx - 1)]);
  const inc = () => onBet(BETS[Math.min(BETS.length - 1, idx + 1)]);

  return (
    <div className="mt-4 rounded-2xl border border-hop-gold/35 bg-black/55 p-3 backdrop-blur-xl sm:p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Meter label="Zůstatek" value={formatKc(balance)} />
        <Meter label="Sázka" value={formatKc(bet)} />
        <Meter label="Výhra" value={formatKc(lastWin)} highlight={lastWin > 0} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-between">
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={dec} disabled={spinning || idx <= 0} label="Snížit sázku">
            <Minus className="h-4 w-4" />
          </IconBtn>
          <div className="min-w-20 rounded-lg border border-hop-gold/30 bg-hop-950/80 px-3 py-1.5 text-center font-mono text-sm font-bold text-hop-gold">
            {bet}
          </div>
          <IconBtn onClick={inc} disabled={spinning || idx >= BETS.length - 1} label="Zvýšit sázku">
            <Plus className="h-4 w-4" />
          </IconBtn>
          <button
            onClick={onMaxBet}
            disabled={spinning}
            className="rounded-lg border border-hop-gold/40 bg-hop-gold/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-hop-gold disabled:opacity-40"
          >
            Max bet
          </button>
        </div>

        <motion.button
          onClick={onSpin}
          disabled={spinning}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.04 }}
          className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-hop-gold/70 bg-gradient-to-b from-hop-gold via-amber-500 to-hop-gold-deep font-display text-sm font-black uppercase tracking-[0.12em] text-hop-950 shadow-[0_0_60px_-12px_rgba(255,204,68,0.95)] disabled:opacity-70 sm:h-28 sm:w-28 sm:text-base"
        >
          <motion.span
            className="absolute inset-1 rounded-full border border-white/40"
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={spinning ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
            style={{ borderStyle: "dashed" }}
          />
          <span className="relative">
            {freeSpinsLeft > 0 ? "FREE\nSPIN" : spinning ? "…" : "SPIN"}
          </span>
        </motion.button>

        <div className="flex items-center gap-1.5">
          {autoLeft > 0 ? (
            <button
              onClick={onStopAuto}
              className="rounded-lg border border-rose-400/50 bg-rose-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300"
            >
              Stop auto ({autoLeft})
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-lg border border-hop-gold/30 bg-hop-950/70 px-2 py-1">
              <Repeat className="h-3.5 w-3.5 text-hop-gold/80" />
              {AUTO_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => onAuto(n)}
                  disabled={spinning}
                  className="rounded px-1.5 py-1 font-mono text-[11px] font-bold text-hop-neon hover:bg-hop-neon/15 disabled:opacity-40"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <IconBtn onClick={onHof} label="Hall of Fame">
            <Trophy className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={onInfo} label="Paytable">
            <Info className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function Meter({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-hop-gold/20 bg-hop-950/70 px-2 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-hop-neon/70">{label}</p>
      <p
        className={`font-display text-sm font-black tabular-nums sm:text-lg ${
          highlight ? "slot-gold-text" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg border border-hop-gold/30 bg-hop-950/80 p-2 text-hop-gold transition hover:bg-hop-gold/15 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
