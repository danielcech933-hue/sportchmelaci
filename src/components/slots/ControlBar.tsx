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
    <div className="mt-4 rounded-[20px] border border-hop-gold/30 bg-[linear-gradient(180deg,rgba(7,31,17,0.94),rgba(1,8,4,0.98))] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-4">
      <div className="grid grid-cols-3 gap-2">
        <Meter label="Zůstatek" value={formatKc(balance)} />
        <Meter label="Aktivní sázka" value={formatKc(bet)} />
        <Meter label="Poslední výhra" value={formatKc(lastWin)} highlight={lastWin > 0} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex items-center justify-center gap-1.5 lg:justify-start">
          <IconBtn onClick={dec} disabled={spinning || idx <= 0} label="Snížit sázku"><Minus className="h-4 w-4" /></IconBtn>
          <div className="min-w-24 rounded-xl border border-hop-gold/35 bg-black/45 px-3 py-2 text-center font-mono text-sm font-black text-hop-gold shadow-inner">
            {formatKc(bet)}
          </div>
          <IconBtn onClick={inc} disabled={spinning || idx >= BETS.length - 1} label="Zvýšit sázku"><Plus className="h-4 w-4" /></IconBtn>
          <button
            onClick={onMaxBet}
            disabled={spinning}
            className="rounded-xl border border-hop-gold/40 bg-hop-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-hop-gold transition hover:bg-hop-gold/20 disabled:opacity-40"
          >
            MAX
          </button>
        </div>

        <motion.button
          onClick={onSpin}
          disabled={spinning}
          aria-label={spinning ? "Válce se točí" : "Roztočit válce"}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.035 }}
          className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-hop-gold bg-[radial-gradient(circle_at_35%_25%,#fff2a8,#ffcc44_38%,#9a6500_100%)] font-display text-sm font-black uppercase tracking-[0.14em] text-hop-950 shadow-[0_0_0_5px_rgba(255,204,68,0.08),0_0_55px_-10px_rgba(255,204,68,0.95),inset_0_2px_8px_rgba(255,255,255,0.55)] disabled:cursor-wait disabled:opacity-70 sm:h-28 sm:w-28 sm:text-base"
        >
          <span className="absolute inset-1.5 rounded-full border border-hop-950/25" />
          <motion.span
            className="absolute inset-2.5 rounded-full border border-white/55"
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={spinning ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
            style={{ borderStyle: "dashed" }}
          />
          <span className="relative z-10 whitespace-pre-line text-center leading-tight">
            {freeSpinsLeft > 0 ? "FREE\nSPIN" : spinning ? "TOČÍM" : "SPIN"}
          </span>
        </motion.button>

        <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-end">
          {autoLeft > 0 ? (
            <button
              onClick={onStopAuto}
              className="rounded-xl border border-rose-400/50 bg-rose-500/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-300"
            >
              STOP AUTO · {autoLeft}
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-xl border border-hop-gold/25 bg-black/35 px-2 py-1.5">
              <Repeat className="h-3.5 w-3.5 text-hop-gold/80" />
              {AUTO_OPTIONS.map((n) => (
                <button key={n} onClick={() => onAuto(n)} disabled={spinning} className="rounded-lg px-2 py-1 font-mono text-[11px] font-bold text-hop-neon transition hover:bg-hop-neon/15 disabled:opacity-40">{n}</button>
              ))}
            </div>
          )}
          <IconBtn onClick={onHof} label="Hall of Fame"><Trophy className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={onInfo} label="Výplatní tabulka"><Info className="h-4 w-4" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function Meter({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-hop-gold/20 bg-black/30 px-2 py-2 text-center shadow-inner sm:px-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-hop-gold/60 to-transparent" />
      <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-hop-neon/65 sm:text-[9px]">{label}</p>
      <p className={`font-display text-sm font-black tabular-nums sm:text-lg ${highlight ? "slot-gold-text" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-xl border border-hop-gold/30 bg-black/35 p-2 text-hop-gold transition hover:border-hop-gold/55 hover:bg-hop-gold/15 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
