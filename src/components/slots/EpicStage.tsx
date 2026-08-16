import { motion } from "framer-motion";

export type EpicGame = "thunder-egg" | "bass-bounty";

/** Layered original art-direction backdrop for the epic slots (no external assets). */
export function EpicBackdrop({ game, spinning }: { game: EpicGame; spinning: boolean }) {
  return game === "thunder-egg" ? <OlympusBackdrop spinning={spinning} /> : <DeepWaterBackdrop spinning={spinning} />;
}

function OlympusBackdrop({ spinning }: { spinning: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#1a2352_0%,#0a0f24_45%,#03050c_100%)]" />
      {/* temple silhouette */}
      <svg viewBox="0 0 1200 400" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[58%] w-full opacity-60">
        <defs>
          <linearGradient id="temple" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#2a2f63" stopOpacity=".9" />
            <stop offset="1" stopColor="#05070f" />
          </linearGradient>
        </defs>
        <path d="M120 400V150l160-70 160 70v250Z" fill="url(#temple)" />
        <path d="M760 400V180l150-64 150 64v220Z" fill="url(#temple)" opacity=".8" />
        <path d="M300 90h580l-40-46H340Z" fill="#3a3f7d" opacity=".55" />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={330 + i * 62} y={100} width="26" height="300" fill="#1b2049" opacity=".85" />
        ))}
      </svg>
      {/* electric clouds */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-[50%] blur-3xl"
          style={{
            top: `${4 + i * 14}%`,
            left: `${-15 + i * 26}%`,
            width: "58%",
            height: "34%",
            background: i % 2 ? "radial-gradient(circle,rgba(120,140,255,.30),transparent 65%)" : "radial-gradient(circle,rgba(255,214,107,.22),transparent 65%)",
          }}
          animate={{ x: [0, 60, 0], opacity: spinning ? [0.5, 0.95, 0.5] : [0.28, 0.55, 0.28] }}
          transition={{ duration: 9 - i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* lightning streaks */}
      {[18, 52, 84].map((left, i) => (
        <motion.svg
          key={left}
          viewBox="0 0 40 200"
          className="absolute top-0 h-[62%] w-16"
          style={{ left: `${left}%` }}
          animate={{ opacity: spinning ? [0, 0.95, 0, 0.6, 0] : [0, 0.55, 0] }}
          transition={{ duration: spinning ? 1.1 : 5.5, repeat: Infinity, delay: i * 0.7, times: [0, 0.1, 0.2, 0.3, 1] }}
        >
          <path d="M22 0 8 88h14L4 200l30-124H18L30 0Z" fill="#fff6c0" opacity=".9" />
          <path d="M22 0 8 88h14L4 200l30-124H18L30 0Z" fill="none" stroke="#8fb2ff" strokeWidth="2" />
        </motion.svg>
      ))}
      {/* golden dust */}
      {Array.from({ length: 22 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-amber-200/80"
          style={{ left: `${(i * 41) % 100}%`, top: `${(i * 67) % 100}%` }}
          animate={{ y: [0, -40 - (i % 5) * 18, 0], opacity: [0, 0.9, 0] }}
          transition={{ duration: 5 + (i % 4), repeat: Infinity, delay: i * 0.24 }}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_0,transparent_2px,rgba(0,0,0,.22)_3px)] bg-[length:100%_3px] opacity-30" />
    </div>
  );
}

function DeepWaterBackdrop({ spinning }: { spinning: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_-15%,#0b6f92_0%,#053648_38%,#020d16_100%)]" />
      {/* underwater light shafts */}
      {[10, 30, 52, 74, 90].map((left, i) => (
        <motion.div
          key={left}
          className="absolute -top-10 h-[130%] w-24 origin-top blur-md"
          style={{
            left: `${left}%`,
            background: "linear-gradient(180deg,rgba(190,245,255,.34),rgba(190,245,255,.05) 55%,transparent)",
            transform: `rotate(${i % 2 ? 9 : -7}deg)`,
          }}
          animate={{ opacity: spinning ? [0.35, 0.85, 0.35] : [0.18, 0.45, 0.18] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* surface caustics */}
      <motion.div
        className="absolute inset-x-0 top-0 h-40 opacity-45"
        style={{ backgroundImage: "repeating-linear-gradient(100deg,transparent 0 18px,rgba(160,240,255,.22) 19px,transparent 22px)" }}
        animate={{ x: [0, 26, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* seabed */}
      <svg viewBox="0 0 1200 260" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[36%] w-full opacity-70">
        <path d="M0 260V150c120-40 220 10 330-16s180-64 300-40 200 66 330 40 240-24 240-24v150Z" fill="#031a26" />
        <path d="M0 260V190c150-26 240 22 380 4s210-52 340-32 260 52 480 20v78Z" fill="#010e16" />
      </svg>
      {/* bubbles */}
      {Array.from({ length: 26 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-cyan-100/40 bg-cyan-100/10"
          style={{ left: `${(i * 37) % 100}%`, bottom: "-6%", width: 4 + (i % 4) * 3, height: 4 + (i % 4) * 3 }}
          animate={{ y: [0, -520 - (i % 5) * 60], opacity: [0, 0.8, 0], x: [0, (i % 2 ? 22 : -22)] }}
          transition={{ duration: 7 + (i % 5) * 1.4, repeat: Infinity, delay: i * 0.35, ease: "easeOut" }}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_35%,rgba(0,0,0,.6)_100%)]" />
    </div>
  );
}
