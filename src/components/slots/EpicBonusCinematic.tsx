import { AnimatePresence, motion } from "framer-motion";
import { Anchor, Fish, Waves, Zap } from "lucide-react";
import type { EpicGame } from "@/components/slots/EpicStage";

export type EpicFeature = { key: string; title: string; blurb: string };

export const EPIC_FEATURES: Record<EpicGame, EpicFeature[]> = {
  "thunder-egg": [
    { key: "storm", title: "STORM ASCENSION", blurb: "Každý zásah blesku zvedá globální multiplier o stupeň výš." },
    { key: "wheel", title: "THUNDER WHEEL", blurb: "Kolo bohů rozdá free spiny nebo okamžitý coin payout." },
    { key: "superstar", title: "SUPREME THUNDER", blurb: "Nejvyšší režim: divine reveal na celé mřížce a maximální multipliery." },
  ],
  "bass-bounty": [
    { key: "big_catch", title: "MEGA CATCH", blurb: "Collector wild sesbírá všechny money coins na obrazovce." },
    { key: "wheel", title: "DEEP WATER", blurb: "Ponor do hloubky: vyšší hodnoty coinů a extra free spiny." },
    { key: "expedition", title: "WILD EXPEDITION", blurb: "Rybářské wildy zůstávají na místě a řetězí úlovky." },
  ],
};

export function featureFor(game: EpicGame, mode: string | null | undefined): EpicFeature {
  const list = EPIC_FEATURES[game];
  return list.find((f) => f.key === mode) ?? list[0];
}

/** Fullscreen cinematic bonus intro with a dedicated visual per game. */
export function EpicBonusCinematic({
  open,
  game,
  mode,
  spins,
  multiplier,
}: {
  open: boolean;
  game: EpicGame;
  mode: string | null | undefined;
  spins: number;
  multiplier: number;
}) {
  const feature = featureFor(game, mode);
  const thunder = game === "thunder-egg";
  const hue = thunder ? "#ffd86b" : "#66e6ff";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[950] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/88 backdrop-blur-md" />
          {thunder ? <ThunderBonusFX /> : <WaterBonusFX />}
          <motion.div
            initial={{ scale: 0.55, y: 60, rotateX: -24, opacity: 0 }}
            animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: "spring", stiffness: 170, damping: 15 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] p-[2px]"
            style={{ background: `linear-gradient(140deg, ${hue}, rgba(255,255,255,.15), ${hue}55)` }}
          >
            <div className="relative overflow-hidden rounded-[1.9rem] bg-[#05070d]/95 px-6 py-9 text-center sm:px-12">
              <motion.div
                className="pointer-events-none absolute inset-0"
                animate={{ opacity: [0.25, 0.6, 0.25] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                style={{ background: `radial-gradient(circle at 50% 0%, ${hue}33, transparent 60%)` }}
              />
              <motion.div
                animate={{ scale: [1, 1.12, 1], rotate: thunder ? [0, 6, -6, 0] : [0, -4, 4, 0] }}
                transition={{ duration: 1.3, repeat: Infinity }}
                className="relative mx-auto grid h-24 w-24 place-items-center rounded-full border"
                style={{ borderColor: `${hue}88`, background: `${hue}18`, boxShadow: `0 0 60px -8px ${hue}` }}
              >
                {thunder ? <Zap className="h-11 w-11" style={{ color: hue }} /> : <Fish className="h-11 w-11" style={{ color: hue }} />}
              </motion.div>
              <div className="relative mt-5 font-mono text-[10px] font-black uppercase tracking-[.45em] text-white/60">
                {thunder ? "OLYMPUS FEATURE UNLOCKED" : "DEEP WATER FEATURE UNLOCKED"}
              </div>
              <h3
                className="relative mt-2 font-display text-3xl font-black uppercase tracking-[.1em] text-white sm:text-5xl"
                style={{ textShadow: `0 0 44px ${hue}` }}
              >
                {feature.title}
              </h3>
              <p className="relative mx-auto mt-3 max-w-md text-xs leading-relaxed text-white/60 sm:text-sm">{feature.blurb}</p>
              <div className="relative mt-7 grid grid-cols-2 gap-3">
                <Stat label="FREE SPINS" value={String(spins)} hue={hue} />
                <Stat label="MULTIPLIER" value={`${multiplier.toFixed(1)}×`} hue={hue} />
              </div>
              <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: hue }}
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3.4, ease: "linear" }}
                />
              </div>
              <p className="relative mt-3 font-mono text-[8px] uppercase tracking-[.24em] text-white/30">
                SPORTCHMELÁCI · SERVER AUTHORITATIVE BONUS
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, hue }: { label: string; value: string; hue: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="font-mono text-[8px] font-black uppercase tracking-[.24em] text-white/40">{label}</div>
      <div className="mt-1 font-display text-3xl font-black" style={{ color: hue }}>
        {value}
      </div>
    </div>
  );
}

function ThunderBonusFX() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[12, 34, 58, 80].map((left, i) => (
        <motion.svg
          key={left}
          viewBox="0 0 40 200"
          className="absolute top-0 h-2/3 w-20"
          style={{ left: `${left}%` }}
          animate={{ opacity: [0, 1, 0, 0.7, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.32 }}
        >
          <path d="M22 0 8 88h14L4 200l30-124H18L30 0Z" fill="#fff8cf" />
        </motion.svg>
      ))}
      {Array.from({ length: 34 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-amber-200"
          style={{ left: "50%", top: "50%", boxShadow: "0 0 12px #ffd86b" }}
          animate={{ x: Math.cos((i / 34) * 6.28) * (200 + (i % 5) * 60), y: Math.sin((i / 34) * 6.28) * (150 + (i % 4) * 60), opacity: [1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: (i % 6) * 0.2 }}
        />
      ))}
    </div>
  );
}

function WaterBonusFX() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 opacity-40"
        style={{ backgroundImage: "repeating-linear-gradient(96deg,transparent 0 22px,rgba(160,240,255,.25) 23px,transparent 27px)" }}
        animate={{ x: [0, 40, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      {Array.from({ length: 32 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-cyan-100/40 bg-cyan-100/10"
          style={{ left: `${(i * 31) % 100}%`, bottom: "-5%", width: 5 + (i % 4) * 4, height: 5 + (i % 4) * 4 }}
          animate={{ y: [0, -700], opacity: [0, 0.9, 0] }}
          transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: i * 0.14 }}
        />
      ))}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-cyan-200/40"
        animate={{ y: [0, -12, 0], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Waves className="h-16 w-16" />
      </motion.div>
      <motion.div
        className="absolute right-8 top-10 text-cyan-100/30"
        animate={{ rotate: [0, 12, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <Anchor className="h-14 w-14" />
      </motion.div>
    </div>
  );
}
