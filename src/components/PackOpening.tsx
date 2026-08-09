import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, PackageOpen, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { FootballCard } from "@/components/FootballCard";
import { CARD_TYPE_META, NATION_FLAG, cardsErrorMessage, chibiFor, openPack } from "@/lib/cards";
import type { FootballCardData, PackRow } from "@/types/cards";
import { cn } from "@/lib/utils";

type Phase = "idle" | "drop" | "nation" | "position" | "club" | "reveal";

interface Props {
  packs: PackRow[];
  onOpened: () => void;
}

/** Dramatická sekvence otevírání balíčku s walkoutem pro karty 86+. */
export function PackOpening({ packs, onOpened }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pulled, setPulled] = useState<FootballCardData[]>([]);
  const [hero, setHero] = useState<FootballCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const walkout = !!hero && hero.rating >= 86;

  useEffect(() => {
    if (phase === "idle" || phase === "reveal") return;
    const order: Phase[] = ["drop", "nation", "position", "club", "reveal"];
    const i = order.indexOf(phase);
    const t = window.setTimeout(() => setPhase(order[i + 1]), phase === "drop" ? 1100 : 900);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "reveal" || !hero) return;
    confetti({
      particleCount: walkout ? 220 : 90,
      spread: walkout ? 110 : 70,
      origin: { y: 0.6 },
      colors: ["#ffd166", "#3ef2a1", "#e879f9"],
    });
    onOpened();
  }, [phase, hero, walkout, onOpened]);

  async function open(pack: PackRow) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const cards = await openPack(pack.id);
      const best = [...cards].sort((a, b) => b.rating - a.rating)[0] ?? null;
      setPulled(cards);
      setHero(best);
      setPhase("drop");
    } catch (e) {
      setError(cardsErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setPhase("idle");
    setHero(null);
    setPulled([]);
  }

  const gold = packs.filter((p) => p.packType === "gold");
  const promo = packs.filter((p) => p.packType === "promo");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { type: "gold" as const, list: gold, title: "Gold Pack", desc: "3 karty · šance na 88+", emoji: "🟨" },
          { type: "promo" as const, list: promo, title: "Promo Pack", desc: "3 karty · vyšší šance na Icon", emoji: "🟪" },
        ].map((p) => (
          <div
            key={p.type}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-4 backdrop-blur",
              p.type === "gold" ? "border-amber-300/40 bg-amber-500/10" : "border-fuchsia-300/40 bg-fuchsia-500/10",
            )}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">{p.emoji} {p.title}</p>
            <p className="mt-1 font-display text-3xl tracking-widest">{p.list.length}×</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
            <button
              onClick={() => p.list[0] && open(p.list[0])}
              disabled={!p.list.length || busy}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary disabled:opacity-40"
            >
              <PackageOpen className="h-3.5 w-3.5" /> Otevřít balíček
            </button>
          </div>
        ))}
      </div>

      {!packs.length && (
        <p className="rounded-2xl border border-border/50 bg-background/50 p-4 text-xs text-muted-foreground">
          <Gift className="mr-1 inline h-3.5 w-3.5" /> Balíčky padají za výhry a bonusy ve slotu Chmelovci Cup.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 p-4",
              walkout && phase !== "drop" ? "bg-black/95" : "bg-black/85",
            )}
          >
            {walkout && phase !== "drop" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.8, scale: 1.4, rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="pointer-events-none absolute h-[130vmax] w-[130vmax] bg-[conic-gradient(rgba(255,209,102,0.35)_0deg,transparent_22deg,rgba(255,209,102,0.35)_44deg,transparent_66deg,rgba(255,209,102,0.35)_88deg,transparent_110deg)]"
              />
            )}

            {phase === "drop" && (
              <motion.div
                initial={{ y: -320, rotate: -12, opacity: 0 }}
                animate={{ y: 0, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 12 }}
                className="relative flex h-56 w-40 items-center justify-center rounded-2xl border-2 border-hop-gold/70 bg-gradient-to-b from-amber-300/30 to-black shadow-[0_0_60px_-8px_rgba(255,209,102,0.8)]"
              >
                <Sparkles className="h-10 w-10 text-hop-gold" />
                <span className="absolute bottom-3 font-mono text-[10px] uppercase tracking-[0.3em] text-hop-gold">
                  Pack
                </span>
              </motion.div>
            )}

            {hero && phase !== "drop" && phase !== "reveal" && (
              <motion.div
                key={phase}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative text-center"
              >
                {phase === "nation" && <p className="text-7xl">{NATION_FLAG[hero.nation] ?? "🏳️"}</p>}
                {phase === "position" && (
                  <p className="font-display text-6xl tracking-widest text-primary">{hero.position}</p>
                )}
                {phase === "club" && (
                  <p className="font-display text-3xl uppercase tracking-[0.2em] text-hop-gold">{hero.club}</p>
                )}
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.4em] text-foreground/60">
                  {phase === "nation" ? "Národ" : phase === "position" ? "Pozice" : "Klub"}
                </p>
              </motion.div>
            )}

            {phase === "reveal" && hero && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 130, damping: 14 }}
                className="relative flex w-full max-w-md flex-col items-center gap-4"
              >
                {walkout && (
                  <p className="font-display text-2xl tracking-[0.3em] text-hop-gold">WALKOUT!</p>
                )}
                <img
                  src={chibiFor(hero)}
                  alt={`${hero.name} walkout`}
                  loading="lazy"
                  width={768}
                  height={768}
                  className="h-40 w-40 object-contain drop-shadow-[0_10px_30px_rgba(255,209,102,0.6)]"
                />
                <FootballCard card={hero} size="lg" />
                <div className="flex flex-wrap justify-center gap-2">
                  {pulled
                    .filter((c) => c.id !== hero.id)
                    .map((c) => (
                      <FootballCard key={c.key} card={c} size="sm" />
                    ))}
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  {CARD_TYPE_META[hero.cardType].label} · uloženo do sbírky
                </p>
                <button
                  onClick={close}
                  className="rounded-full border border-primary/50 bg-primary/15 px-6 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"
                >
                  Pokračovat
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PackOpening;
