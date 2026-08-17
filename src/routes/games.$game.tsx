import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Dices, Layers3, Spade, Users, Zap, Shield, Sparkles } from "lucide-react";
import { PokerArena3D } from "@/components/PokerArena3D";
import { LiveRouletteServer } from "@/components/LiveRouletteServer";

const GAME_META = {
  poker: { title: "POKER LOBBY", eyebrow: "// CARD ROOM", description: "Skutečný multiplayer Texas Hold'em. Připoj se ke stolu, posaď se na volné místo a počkej na další skutečné hráče.", icon: Spade, tone: "text-amber-300", accent: "border-amber-300/30" },
  roulette: { title: "RULETA LIVE", eyebrow: "// ROULETTE FLOOR", description: "Živá serverová ruleta s odpočtem do uzavření a společným kolem. Vše je server-authoritative a pouze play-money.", icon: Dices, tone: "text-emerald-300", accent: "border-emerald-300/30" },
  ultimate: { title: "ULTIMATE LOBBY", eyebrow: "// FC ULTIMATE", description: "Vstupní hala pro sestavy, Card Spin, sbírku a online zápasy. Každý režim má vlastní flow.", icon: Layers3, tone: "text-primary", accent: "border-primary/30" },
} as const;

type Game = keyof typeof GAME_META;

export const Route = createFileRoute("/games/$game")({ component: GameLobby });

function GameLobby() {
  const { game: rawGame } = Route.useParams();
  const game = rawGame as Game;
  const meta = GAME_META[game];
  if (!meta) throw notFound();
  const Icon = meta.icon;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pb-32 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Lobby</Link>
      <section className={`relative mt-5 overflow-hidden rounded-3xl border ${meta.accent} bg-background/60 p-6 backdrop-blur-xl sm:p-8`}>
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">{meta.eyebrow}</p>
            <div className="mt-3 flex items-center gap-3"><span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 ${meta.tone}`}><Icon className="h-6 w-6" /></span><h1 className="font-display text-4xl tracking-[0.08em] neon-text sm:text-6xl">{meta.title}</h1></div>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">{meta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground"><span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-2">LIVE LOBBY</span><span className="rounded-full border border-border/70 bg-background/50 px-3 py-2">PLAY MONEY</span></div>
        </div>
      </section>
      {game === "poker" ? <PokerPage /> : game === "roulette" ? <RoulettePage /> : <UltimateLobby />}
    </main>
  );
}

function PokerPage() {
  return <section className="mt-5 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><InfoTile icon={Users} label="Jak začít" value="Připojit se" /><InfoTile icon={Sparkles} label="Start" value="2+ READY" /><InfoTile icon={Shield} label="Engine" value="Server auth" /></div><PokerArena3D /></section>;
}

function RoulettePage() {
  return <section className="mt-5 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><InfoTile icon={Users} label="Stůl" value="Live players" /><InfoTile icon={Zap} label="Sázky" value="Server auth" /><InfoTile icon={Shield} label="Režim" value="Play money" /></div><LiveRouletteServer /></section>;
}

function UltimateLobby() {
  const modes = [{ title: "Sestava", detail: "Správa karet a chemie", href: "/ultimate-team" }, { title: "Card Spin", detail: "Otoč kartu a rozšiř sbírku", href: "/ultimate-team" }, { title: "FUT Match", detail: "Online zápasy", href: "/ultimate-team" }];
  return <section className="mt-6"><div className="mb-3"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// GAME MODES</p><h2 className="mt-1 font-display text-2xl tracking-wider neon-text">ULTIMATE HUB</h2></div><div className="grid gap-3 md:grid-cols-3">{modes.map((mode) => <Link key={mode.title} to={mode.href} className="rounded-2xl border border-border/60 bg-background/55 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40"><p className="font-display text-xl tracking-wider text-primary">{mode.title}</p><p className="mt-2 min-h-10 text-sm text-muted-foreground">{mode.detail}</p><span className="mt-5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Otevřít <ChevronRight className="h-3.5 w-3.5" /></span></Link>)}</div></section>;
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="rounded-2xl border border-border/60 bg-background/45 p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><p className="font-mono text-[9px] uppercase tracking-[0.24em]">{label}</p></div><p className="mt-2 font-display text-lg tracking-widest text-primary">{value}</p></div>;
}
