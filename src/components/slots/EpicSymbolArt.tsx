import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Game = "thunder-egg" | "bass-bounty";

type Props = { game: Game; symbol: string; className?: string; style?: CSSProperties };

const gold = "#ffd86b";
const blue = "#67d7ff";
const ice = "#dff7ff";
const purple = "#9ea7ff";

export function EpicSymbolArt({ game, symbol, className, style }: Props) {
  const common = "h-[62%] w-[62%] max-h-20 max-w-20 drop-shadow-[0_8px_22px_rgba(0,0,0,.65)]";
  if (game === "thunder-egg") return <ThunderArt symbol={symbol} className={cn(common, className)} style={style} />;
  return <BassArt symbol={symbol} className={cn(common, className)} style={style} />;
}

function ThunderArt({ symbol, className, style }: { symbol: string; className?: string; style?: CSSProperties }) {
  if (["zeus_k", "zeus_q", "zeus_j", "zeus_10"].includes(symbol)) {
    return <LetterBadge text={symbol.endsWith("10") ? "10" : symbol.slice(-1)} tone="gold" className={className} style={style} />;
  }
  if (symbol === "egg") return <svg viewBox="0 0 120 120" className={className} style={style}><defs><radialGradient id="egg" cx="35%" cy="25%"><stop offset="0" stopColor="#fff8cf"/><stop offset=".45" stopColor="#ffe18a"/><stop offset="1" stopColor="#bd6b18"/></radialGradient><linearGradient id="eggStroke" x1="0" x2="1"><stop stopColor="#fff2a8"/><stop offset=".5" stopColor="#ffb72d"/><stop offset="1" stopColor="#7b430d"/></linearGradient></defs><ellipse cx="60" cy="62" rx="31" ry="43" fill="url(#egg)" stroke="url(#eggStroke)" strokeWidth="5"/><path d="M46 57c7-10 20-13 29-4 8 8 8 20 1 28-6 7-18 9-27 3-10-7-11-18-3-27Z" fill="#fff6bb" opacity=".35"/><path d="M60 22l7 18 19 1-15 12 5 19-16-10-16 10 5-19-15-12 19-1 7-18Z" fill="#ffe67b" stroke="#b66a13" strokeWidth="3"/><circle cx="50" cy="72" r="3" fill="#fff" opacity=".8"/></svg>;
  if (symbol === "thunder") return <svg viewBox="0 0 120 120" className={className} style={style}><defs><linearGradient id="bolt" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff6a0"/><stop offset=".42" stopColor="#ffd24a"/><stop offset="1" stopColor="#ee8c00"/></linearGradient></defs><path d="M68 7 31 60h24l-11 53 45-67H64Z" fill="url(#bolt)" stroke="#fff4a0" strokeWidth="3"/><path d="M31 61h30" stroke="#fff" strokeWidth="4" opacity=".7"/><circle cx="82" cy="25" r="8" fill="#fff" opacity=".28"/></svg>;
  if (symbol === "eagle") return <svg viewBox="0 0 120 120" className={className} style={style}><defs><linearGradient id="eagle" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff4bd"/><stop offset=".5" stopColor="#d2a84f"/><stop offset="1" stopColor="#5a3211"/></linearGradient></defs><path d="M14 73 35 39l21 14 4-22 4 22 21-14 21 34-27-9-19 22-19-22Z" fill="url(#eagle)" stroke="#ffd66a" strokeWidth="3"/><path d="M44 67c9 5 24 5 33 0" fill="none" stroke="#fff4b5" strokeWidth="3"/><circle cx="60" cy="58" r="6" fill="#ffd86b"/></svg>;
  if (symbol === "pillar") return <svg viewBox="0 0 120 120" className={className} style={style}><path d="M23 28h74v13H23zm10 13h54l-7 51H40Z" fill="#d7b45b" stroke="#fff0a0" strokeWidth="3"/><path d="M17 92h86v12H17z" fill="#8f5b18"/><path d="M38 43h44M43 51h34M41 80h38" stroke="#fff2b0" strokeWidth="4" opacity=".55"/></svg>;
  if (symbol === "hand") return <svg viewBox="0 0 120 120" className={className} style={style}><path d="M37 87c-7-7-10-17-9-30l2-27c1-6 9-7 11-1l3 25 1-42c0-7 10-8 11-1l2 39 3-46c0-7 10-7 11 0l2 43 4-34c1-6 10-6 11 1l-1 43 7-22c3-7 11-5 10 2l-5 29c-4 18-13 27-31 34Z" fill="#ffd86b" stroke="#fff2a6" strokeWidth="3"/><circle cx="72" cy="47" r="7" fill="#fff" opacity=".35"/></svg>;
  if (symbol === "wild" || symbol === "scatter") return <svg viewBox="0 0 120 120" className={className} style={style}><defs><radialGradient id="star"><stop stopColor="#fff"/><stop offset=".25" stopColor="#ffd86b"/><stop offset="1" stopColor="#8c4b00"/></radialGradient></defs><path d="m60 8 12 34 37 2-29 23 10 36-30-20-30 20 10-36L11 44l37-2Z" fill="url(#star)" stroke="#fff0a0" strokeWidth="3"/><circle cx="60" cy="55" r="9" fill="#fff" opacity=".35"/></svg>;
  return <LetterBadge text="W" tone="gold" className={className} style={style} />;
}

function BassArt({ symbol, className, style }: { symbol: string; className?: string; style?: CSSProperties }) {
  if (["fish_k", "fish_q", "fish_j", "fish_10"].includes(symbol)) return <LetterBadge text={symbol.endsWith("10") ? "10" : symbol.slice(-1)} tone="blue" className={className} style={style} />;
  if (symbol === "fish_money") return <svg viewBox="0 0 120 120" className={className} style={style}><defs><radialGradient id="coin" cx="30%" cy="25%"><stop stopColor="#fff3a4"/><stop offset=".35" stopColor="#ffd45f"/><stop offset="1" stopColor="#a95d10"/></radialGradient></defs><circle cx="60" cy="60" r="37" fill="url(#coin)" stroke="#fff0a8" strokeWidth="5"/><path d="M53 76V44c8-2 18 1 18 8 0 7-8 8-18 8h8c8 0 15 2 15 9 0 8-11 11-23 7" fill="none" stroke="#fff8cb" strokeWidth="5" strokeLinecap="round"/><path d="M39 33h42" stroke="#fff" opacity=".4" strokeWidth="3"/></svg>;
  if (symbol === "fisher") return <svg viewBox="0 0 120 120" className={className} style={style}><circle cx="52" cy="37" r="13" fill="#d28b62" stroke="#ffd6b0" strokeWidth="2"/><path d="M35 63c5-11 28-15 35 0l7 28H31Z" fill="#2c8c67" stroke="#98f4d4" strokeWidth="3"/><path d="M84 24c8 12 9 24 4 35" fill="none" stroke="#d5f6ff" strokeWidth="3"/><path d="M88 58c11 5 14 14 8 23" fill="none" stroke="#d5f6ff" strokeWidth="3"/><circle cx="95" cy="88" r="7" fill="#8df1ff" opacity=".7"/></svg>;
  if (symbol === "hook" || symbol === "lure") return <svg viewBox="0 0 120 120" className={className} style={style}><path d="M66 18v48c0 17-11 28-26 28-11 0-19-8-19-18 0-9 7-16 16-16" fill="none" stroke="#d5f6ff" strokeWidth="8" strokeLinecap="round"/><circle cx="65" cy="18" r="8" fill="#ffd86b"/><path d="M68 77c18-12 29-10 37 2-9 7-20 11-37-2Z" fill="#39b8ef" stroke="#c6f6ff" strokeWidth="3"/></svg>;
  if (symbol === "boat_scatter") return <svg viewBox="0 0 120 120" className={className} style={style}><path d="m15 72 45 12 45-12-8 17c-14 8-60 8-74 0Z" fill="#b56a2c" stroke="#ffd693" strokeWidth="3"/><path d="M59 69V25" stroke="#d5f6ff" strokeWidth="5"/><path d="M61 28h27L62 54Z" fill="#7edcff" opacity=".85"/><circle cx="59" cy="20" r="7" fill="#fff" opacity=".45"/></svg>;
  if (symbol === "angler_wild") return <svg viewBox="0 0 120 120" className={className} style={style}><circle cx="51" cy="39" r="12" fill="#b97852" stroke="#ffe1c9" strokeWidth="2"/><path d="M33 65c5-9 28-11 36 0l7 26H27Z" fill="#2a7fa4" stroke="#adf2ff" strokeWidth="3"/><path d="M75 66c20 3 27 11 24 25" fill="none" stroke="#ffe17a" strokeWidth="4"/><circle cx="99" cy="91" r="9" fill="#ffd86b" stroke="#fff3a4" strokeWidth="3"/></svg>;
  return <LetterBadge text="W" tone="blue" className={className} style={style} />;
}

function LetterBadge({ text, tone, className, style }: { text: string; tone: "gold" | "blue"; className?: string; style?: CSSProperties }) {
  const main = tone === "gold" ? gold : blue;
  const secondary = tone === "gold" ? "#8e5108" : "#0b5577";
  return <div className={cn("relative grid place-items-center", className)} style={style}><svg viewBox="0 0 100 100" className="h-full w-full"><defs><linearGradient id={`letter-${tone}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff"/><stop offset=".22" stopColor={main}/><stop offset=".7" stopColor={main}/><stop offset="1" stopColor={secondary}/></linearGradient></defs><path d="M20 12h60l8 8v60l-8 8H20l-8-8V20Z" fill="#07111b" stroke={main} strokeWidth="4"/><text x="50" y="67" textAnchor="middle" fontSize={text === "10" ? "34" : "53"} fontFamily="Impact, Arial Black, sans-serif" fontWeight="900" fill={`url(#letter-${tone})`} stroke="#07111b" strokeWidth="3" paintOrder="stroke">{text}</text></svg></div>;
}
