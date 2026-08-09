import { CARD_TYPE_META, NATION_FLAG, chibiFor } from "@/lib/cards";
import { cn } from "@/lib/utils";
import type { FootballCardData } from "@/types/cards";

const SIZES = {
  sm: "w-[104px] text-[9px]",
  md: "w-[150px] text-[10px]",
  lg: "w-[240px] text-xs",
} as const;

interface Props {
  card: FootballCardData;
  size?: keyof typeof SIZES;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

/** Ikonická FC 26 karta s Chibi hráčem. */
export function FootballCard({ card, size = "md", className, onClick, selected }: Props) {
  const meta = CARD_TYPE_META[card.cardType] ?? CARD_TYPE_META.gold;
  const stats: Array<[string, number]> = [
    ["PAC", card.pac],
    ["SHO", card.sho],
    ["PAS", card.pas],
    ["DRI", card.dri],
    ["DEF", card.def],
    ["PHY", card.phy],
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border-2 p-2 text-left backdrop-blur transition-transform",
        meta.frame,
        meta.glow,
        onClick && "hover:-translate-y-1",
        selected && "ring-2 ring-primary",
        SIZES[size],
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.25),transparent_60%)]" />
      <div className="relative flex items-start justify-between">
        <div className="leading-none">
          <p className={cn("font-display text-2xl tracking-tight", meta.accent)}>{card.rating}</p>
          <p className={cn("mt-0.5 font-mono uppercase tracking-widest", meta.text)}>{card.position}</p>
          <p className="mt-1 text-base leading-none">{NATION_FLAG[card.nation] ?? "🏳️"}</p>
          <p className={cn("mt-1 max-w-[54px] truncate font-mono uppercase opacity-70", meta.text)}>{card.club}</p>
        </div>
        <img
          src={chibiFor(card)}
          alt={`${card.name} chibi karta`}
          loading="lazy"
          width={768}
          height={768}
          className="-mr-1 -mt-1 w-[62%] drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]"
        />
      </div>
      <p className={cn("relative mt-1 truncate text-center font-display uppercase tracking-[0.14em]", meta.text)}>
        {card.name}
      </p>
      <div className={cn("relative mt-1 grid grid-cols-3 gap-x-1 gap-y-0.5 border-t border-white/20 pt-1", meta.text)}>
        {stats.map(([k, v]) => (
          <span key={k} className="flex items-center justify-between font-mono">
            <span className="opacity-60">{k}</span>
            <span className="font-bold">{v}</span>
          </span>
        ))}
      </div>
      <span className={cn("absolute right-2 top-1 font-mono text-[8px] uppercase tracking-[0.2em]", meta.accent)}>
        {meta.label}
      </span>
    </button>
  );
}

export default FootballCard;
