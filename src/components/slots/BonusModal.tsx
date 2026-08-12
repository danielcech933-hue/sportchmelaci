import { motion } from "framer-motion";
import { formatKc } from "@/lib/slots";

export interface BonusOption { spins: number; mult: number; }

const cupLabels = ["CHMEL", "CUP", "MISTR", "LEGEND"];

export function BonusPickModal({ options, onConfirm }: { options: BonusOption[]; onConfirm: (opt: BonusOption) => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#020805]/95 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,204,68,.2),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(77,255,166,.12),transparent_45%)]" />
      <motion.div className="relative w-full max-w-3xl rounded-[2rem] border border-hop-gold/50 bg-[linear-gradient(145deg,#123c24,#030d07_55%,#081b0f)] p-5 text-center shadow-[0_30px_100px_-30px_rgba(255,204,68,.7)] sm:p-8" initial={{ scale: .88, y: 30 }} animate={{ scale: 1, y: 0 }}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-hop-gold/50 bg-hop-gold/10 text-3xl shadow-[0_0_35px_rgba(255,204,68,.35)]">🏆</div>
        <p className="font-mono text-[9px] uppercase tracking-[.35em] text-hop-neon/70">CHMELOVCI CUP · BONUS ROUND</p>
        <h2 className="mt-2 font-display text-3xl tracking-[.16em] slot-gold-text sm:text-5xl">CHMELOVÉ ŠÍLENSTVÍ</h2>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-foreground/70">Vyber si svůj pohár. Odměna se určí serverem a po potvrzení se spustí FREE SPINY.</p>
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {options.map((o, i) => (
            <motion.button key={`${o.spins}-${o.mult}-${i}`} whileHover={{ y: -7, scale: 1.025 }} whileTap={{ scale: .97 }} onClick={() => onConfirm(o)} className="group relative overflow-hidden rounded-2xl border border-hop-gold/35 bg-black/30 p-5 text-left transition-colors hover:border-hop-gold/80 hover:bg-hop-gold/10">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-hop-gold/10 blur-2xl transition-all group-hover:bg-hop-gold/25" />
              <div className="relative flex items-center justify-between"><span className="font-display text-lg slot-gold-text">{cupLabels[i % cupLabels.length]}</span><span className="text-3xl">🏆</span></div>
              <div className="relative mt-5 flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-hop-neon/60">FREE SPINY</p><p className="font-display text-2xl text-hop-neon">{o.spins}</p></div><div className="text-right"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-hop-gold/60">NÁSOBITEL</p><p className="font-display text-2xl slot-gold-text">{o.mult}x</p></div></div>
              <div className="relative mt-4 rounded-lg border border-hop-gold/15 bg-hop-gold/5 py-1.5 font-mono text-[9px] uppercase tracking-[.2em] text-hop-gold/80">Vybrat pohár</div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function BonusRecapModal({ total, spins, mult, onClose }: { total: number; spins: number; mult: number; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020805]/95 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-hop-gold/55 bg-[linear-gradient(145deg,#123c24,#030d07)] p-7 text-center shadow-[0_30px_100px_-25px_rgba(255,204,68,.75)]" initial={{ scale: .82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle,rgba(255,204,68,.25),transparent_65%)]" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hop-gold/50 bg-hop-gold/10 text-4xl">🏆</div>
        <p className="relative mt-4 font-mono text-[9px] uppercase tracking-[.3em] text-hop-neon/70">CHMELOVCI CUP · BONUS COMPLETE</p>
        <h2 className="relative mt-2 font-display text-4xl tracking-[.12em] slot-gold-text sm:text-6xl">{formatKc(total)}</h2>
        <div className="relative mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2"><div className="rounded-xl border border-hop-gold/15 bg-black/25 p-3"><p className="font-mono text-[8px] uppercase tracking-widest text-hop-neon/60">FREE SPINY</p><p className="font-display text-xl text-hop-neon">{spins}</p></div><div className="rounded-xl border border-hop-gold/15 bg-black/25 p-3"><p className="font-mono text-[8px] uppercase tracking-widest text-hop-gold/60">NÁSOBITEL</p><p className="font-display text-xl slot-gold-text">{mult}x</p></div></div>
        <button onClick={onClose} className="relative mt-6 rounded-full border border-hop-gold/60 bg-hop-gold/15 px-7 py-2.5 font-display text-sm uppercase tracking-[.2em] text-hop-gold transition hover:bg-hop-gold/25">Pokračovat</button>
      </motion.div>
    </motion.div>
  );
}
