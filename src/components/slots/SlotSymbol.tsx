import { motion } from "framer-motion";
import { SLOT_SYMBOLS, type SymKey } from "@/lib/slots";

interface SlotSymbolProps { symbol: SymKey; size?: "sm" | "md" | "lg"; winning?: boolean; dim?: boolean; }

const PALETTE: Record<SymKey, { card: string; accent: string; rarity: string }> = {
  ten: { card: "from-[#0b3a20] via-[#082716] to-[#020906]", accent: "#dff6d9", rarity: "LOW" },
  j: { card: "from-[#0b3d21] via-[#092a18] to-[#020906]", accent: "#c6f2cf", rarity: "LOW" },
  q: { card: "from-[#0d4323] via-[#0a2f1a] to-[#020906]", accent: "#9df0b4", rarity: "LOW" },
  k: { card: "from-[#104a27] via-[#0b321c] to-[#020906]", accent: "#72e99a", rarity: "LOW" },
  a: { card: "from-[#4a2d05] via-[#154524] to-[#06120a]", accent: "#ffdc68", rarity: "LOW" },
  whistle: { card: "from-[#084329] via-[#0c5a31] to-[#03170d]", accent: "#e7fff0", rarity: "MID" },
  boots: { card: "from-[#173815] via-[#276122] to-[#061308]", accent: "#d9ff87", rarity: "MID" },
  silver: { card: "from-[#455b57] via-[#143c29] to-[#030a07]", accent: "#eefaf6", rarity: "HIGH" },
  gold: { card: "from-[#5a3607] via-[#1b5529] to-[#07170c]", accent: "#ffe07a", rarity: "HIGH" },
  wild: { card: "from-[#70420a] via-[#176a35] to-[#06170b]", accent: "#ffe995", rarity: "SPECIAL" },
  scatter: { card: "from-[#673608] via-[#176b38] to-[#06160b]", accent: "#fff2bd", rarity: "SPECIAL" },
};

const SIZE = {
  sm: { icon: "h-8 w-8", badge: "text-[6px]" },
  md: { icon: "h-11 w-11 sm:h-14 sm:w-14", badge: "text-[6px] sm:text-[7px]" },
  lg: { icon: "h-16 w-16", badge: "text-[8px]" },
};

function Football({ wild = false }: { wild?: boolean }) {
  return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
    <defs><radialGradient id="ball" cx="35%" cy="25%"><stop stopColor="#fffbe0"/><stop offset=".42" stopColor="#f1c84f"/><stop offset="1" stopColor="#925407"/></radialGradient><filter id="ballGlow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="50" cy="48" r="31" fill="url(#ball)" stroke="#ffe078" strokeWidth="2" filter={wild ? "url(#ballGlow)" : undefined}/>
    <path d="M50 30 61 38 57 51 43 51 39 38Z" fill="#16231b"/>
    <path d="M39 38 26 40m35-2 13 2M43 51l-8 13m22-13 8 13M50 30v-9m-15 45 15 10 15-10" fill="none" stroke="#16231b" strokeWidth="3" strokeLinecap="round"/>
    <path d="M18 79Q50 98 82 79" fill="none" stroke="#8ff09b" strokeWidth="5" opacity=".6"/>
  </svg>;
}

function Trophy({ silver = false }: { silver?: boolean }) {
  const main = silver ? "#e4eeee" : "#ffd54f"; const dark = silver ? "#6f8985" : "#a45b05"; const id = silver ? "silverCup" : "goldCup";
  return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff9d0"/><stop offset=".25" stopColor={main}/><stop offset=".65" stopColor={main}/><stop offset="1" stopColor={dark}/></linearGradient></defs>
    <path d="M29 24h42v18c0 18-9 27-21 27S29 60 29 42Z" fill={`url(#${id})`} stroke="#fff1a4" strokeWidth="2"/>
    <path d="M29 31H17c0 15 8 23 18 24M71 31h12c0 15-8 23-18 24" fill="none" stroke={main} strokeWidth="7" strokeLinecap="round"/>
    <path d="M50 69v12M31 84h38" stroke={main} strokeWidth="7" strokeLinecap="round"/>
    <circle cx="50" cy="44" r="8" fill="#155b31" opacity=".85"/><path d="M46 44l3 3 6-7" fill="none" stroke="#f4ffdc" strokeWidth="2.5"/>
  </svg>;
}

function Boots() { return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true"><defs><linearGradient id="boot" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e4ff9a"/><stop offset=".35" stopColor="#59c849"/><stop offset="1" stopColor="#0b4022"/></linearGradient></defs><path d="M24 23c8 4 18 7 27 8l-4 22-15 13-17-7 8-18Z" fill="url(#boot)" stroke="#edffb3" strokeWidth="2"/><path d="m48 31 21 11 12 18-8 14-24-7-11-14Z" fill="url(#boot)" stroke="#edffb3" strokeWidth="2"/><path d="m25 28 16 9m12 2 19 12M20 55l24 8m5-10 25 8" stroke="#17331d" strokeWidth="4"/><path d="M20 66c-2 5-8 7-13 5m59 4c7 4 14 2 18-3" fill="none" stroke="#ffd34f" strokeWidth="4" strokeLinecap="round"/></svg>; }
function Whistle() { return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true"><path d="M24 43h39c11 0 18 6 18 14s-7 14-18 14H24Z" fill="#dce7e1" stroke="#fff4c5" strokeWidth="3"/><path d="M20 45c-7 1-10 7-10 13s3 12 10 13l10-13Z" fill="#ffcc44" stroke="#fff1a3" strokeWidth="3"/><circle cx="64" cy="57" r="6" fill="#0b2818"/><path d="M55 35c12-8 24-5 31 4M72 28c5-6 11-7 16-3" fill="none" stroke="#ffcc44" strokeWidth="4" strokeLinecap="round"/></svg>; }
function Beer() { return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true"><defs><linearGradient id="beer" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff4aa"/><stop offset=".2" stopColor="#f8c442"/><stop offset="1" stopColor="#a95a08"/></linearGradient></defs><path d="M24 28h45v50H24Z" fill="url(#beer)" stroke="#ffdc72" strokeWidth="3"/><path d="M69 39h10c9 0 12 7 12 16s-4 16-12 16H69" fill="none" stroke="#ffd86a" strokeWidth="7"/><path d="M20 29c3-13 9-17 15-11 5-12 13-10 18-2 8-8 17-3 17 9Z" fill="#fff9e8" stroke="#fff" strokeWidth="2"/><path d="M30 48h30v18H30Z" fill="#166031" opacity=".9"/><text x="45" y="61" textAnchor="middle" fill="#ffdc68" fontSize="10" fontWeight="900">CUP</text></svg>; }
function Rank({ glyph, accent }: { glyph: string; accent: string }) { const id = `rank-${glyph}`; return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff7b9"/><stop offset=".35" stopColor={accent}/><stop offset="1" stopColor="#a45d06"/></linearGradient></defs><path d="M18 25 28 15l11 7 11-11 11 11 11-7 10 10-6 12c-5 10-8 18-8 31H32c0-13-3-21-8-31Z" fill="#155b30" stroke="#d8b63e" strokeWidth="2"/><text x="50" y="72" textAnchor="middle" fontSize="55" fontWeight="950" fontFamily="Arial Black, sans-serif" fontStyle="italic" fill={`url(#${id})`} stroke="#fff2a6" strokeWidth="1.5">{glyph}</text></svg>; }

function SymbolArt({ symbol }: { symbol: SymKey }) { if (symbol === "wild") return <Football wild />; if (symbol === "scatter") return <Beer />; if (symbol === "gold") return <Trophy />; if (symbol === "silver") return <Trophy silver />; if (symbol === "boots") return <Boots />; if (symbol === "whistle") return <Whistle />; return <Rank glyph={SLOT_SYMBOLS[symbol].glyph} accent={PALETTE[symbol].accent} />; }

export function SlotSymbol({ symbol, size = "md", winning = false, dim = false }: SlotSymbolProps) {
  const def = SLOT_SYMBOLS[symbol]; const palette = PALETTE[symbol]; const sizeDef = SIZE[size];
  return <motion.div
    className={`relative flex h-full w-full items-center justify-center p-1 sm:p-1.5 ${dim ? "opacity-25" : ""}`}
    animate={winning ? { scale: [1, 1.08, 1.02, 1.08], y: [0, -2, 0, -1] } : { scale: 1, y: 0 }}
    transition={winning ? { duration: .72, repeat: Infinity, ease: "easeInOut" } : { duration: .18 }}
    aria-label={def.label}
  >
    <div className={`relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-[13px] border border-[#d7ad3d]/20 bg-gradient-to-br ${palette.card} shadow-[inset_0_1px_0_rgba(255,255,255,.13),inset_0_-14px_25px_rgba(0,0,0,.48),0_0_15px_rgba(255,204,68,.06)]`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.04),transparent_45%)]" />
      <div className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full border border-[#d8b33e]/10" />
      <div className="pointer-events-none absolute -bottom-6 -left-4 h-12 w-12 rounded-full border border-[#59d887]/10" />
      <div className={`${sizeDef.icon} relative z-10 drop-shadow-[0_5px_9px_rgba(0,0,0,.85)]`}><SymbolArt symbol={symbol} /></div>
      <span className={`absolute bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap font-black uppercase tracking-[.18em] ${sizeDef.badge}`} style={{ color: palette.accent, opacity: .7 }}>{symbol === "wild" ? "WILD" : symbol === "scatter" ? "SCATTER" : def.label}</span>
      {symbol !== "ten" && symbol !== "j" && symbol !== "q" && symbol !== "k" && symbol !== "a" && <span className="absolute left-1 top-1 z-10 rounded-full border border-white/10 bg-black/25 px-1.5 py-0.5 font-mono text-[5px] font-bold uppercase tracking-[.14em] text-white/45">{palette.rarity}</span>}
      {winning && <motion.div className="pointer-events-none absolute inset-0 rounded-[13px] border-2 border-[#fff0a3]/90" animate={{ opacity: [.25, 1, .35], boxShadow: ["0 0 0 rgba(255,204,68,0)", "0 0 28px rgba(255,204,68,.9)", "0 0 9px rgba(255,204,68,.3)"] }} transition={{ duration: .8, repeat: Infinity }} />}
    </div>
  </motion.div>;
}
