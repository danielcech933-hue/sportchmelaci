import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Dices, Layers3, Spade, Users, Zap, Shield } from "lucide-react";

const GAME_META = {
  poker: {
    title: "POKER LOBBY",
    eyebrow: "// CARD ROOM",
    description: "Vyber stůl podle limitu, obsazenosti a formátu. Každý stůl má vlastní lobby a později vlastní herní server.",
    icon: Spade,
    tone: "text-primary",
    accent: "border-primary/30",
  },
  roulette: {
    title: "RULETA LOBBY",
    eyebrow: "// ROULETTE FLOOR",
    description: "Vyber ruletový stůl podle limitu. Každý stůl bude mít vlastní live session a historii výsledků.",
    icon: Dices,
    tone: "text-accent",
    accent: "border-accent/30",
  },
  ultimate: {
    title: "ULTIMATE LOBBY",
    eyebrow: "// FC ULTIMATE",
    description: "Vstupní hala pro sestavy, Card Spin, sbírku a online zápasy. Každý režim má vlastní flow.",
    icon: Layers3,
    tone: "text-primary",
    accent: "border-primary/30",
  },
} as const;

type Game = keyof typeof GAME_META;

const TABLES: Record<Exclude<Game, "ultimate">, { id: string; name: string; detail: string; occupancy: string; status: "open" | "soon"; }[]> = {
  poker: [
    { id: "poker-micro", name: "CHMEL MICRO", detail: "NLH · $1 / $2", occupancy: "3 / 6", status: "open" },
    { id: "poker-standard", name: "CHMEL STANDARD", detail: "NLH · $5 / $10", occupancy: "4 / 6", status: "open" },
    { id: "poker-high", name: "CYBER HIGH", detail: "NLH · $25 / $50", occupancy: "1 / 6", status: "soon" },
  ],
  roulette: [
    { id: "roulette-green", name: "CHMEL EURO", detail: "European · 0–36", occupancy: "7 / 10", status: "open" },
    { id: "roulette-neon", name: "NEON LIVE", detail: "European · rychlá", occupancy: "4 / 10", status: "open" },
    { id: "roulette-vip", name: "VIP GOLD", detail: "High limit", occupancy: "2 / 10", status: "soon" },
  ],
};

export const Route = createFileRoute("/games/$game")({
  component: GameLobby,
});

function GameLobby() {
  const { game: rawGame } = Route.useParams();
  const game = rawGame as Game;
  const meta = GAME_META[game];
  if (!meta) throw notFound();
  const Icon = meta.icon;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-32 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Lobby
      </Link>

      <section className={`relative mt-5 overflow-hidden rounded-3xl border ${meta.accent} bg-background/60 p-6 backdrop-blur-xl sm:p-10`}>
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">{meta.eyebrow}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 ${meta.tone}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h1 className="font-display text-4xl tracking-[0.08em] neon-text sm:text-6xl">{meta.title}</h1>
            </div>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">{meta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-2">LIVE LOBBY</span>
            <span className="rounded-full border border-border/70 bg-background/50 px-3 py-2">FAIR PLAY</span>
          </div>
        </div>
      </section>

      {game === "ultimate" ? <UltimateLobby /> : <TableLobby game={game} />}
    </main>
  );
}

function TableLobby({ game }: { game: "poker" | "roulette" }) {
  const tables = TABLES[game];
  return (
    <>
      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <LobbyTile icon={Users} label="Hráči online" value={game === "poker" ? "8" : "13"} />
        <LobbyTile icon={Zap} label="Otevřené stoly" value={game === "poker" ? "2" : "2"} />
        <LobbyTile icon={Shield} label="Režim" value="Server auth" />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// TABLE SELECT</p>
            <h2 className="mt-1 font-display text-2xl tracking-wider neon-text">VYBER STŮL</h2>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{tables.length} slots</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {tables.map((table) => (
            <div key={table.id} className="rounded-2xl border border-border/60 bg-background/55 p-4 backdrop-blur transition hover:border-primary/40 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg tracking-wider">{table.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{table.detail}</p>
                </div>
                <span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] ${table.status === "open" ? "bg-emerald-500/10 text-emerald-400" : "bg-primary/10 text-primary"}`}>
                  {table.status === "open" ? "OPEN" : "SOON"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Obsazenost</p>
                  <p className="mt-1 font-display text-xl tracking-widest text-primary">{table.occupancy}</p>
                </div>
                <button
                  type="button"
                  disabled={table.status !== "open"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-display tracking-wider text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  VSTOUPIT <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        Lobby UI je připravené na napojení skutečných serverových stolů; stav obsazenosti je nyní pouze prezentační.
      </p>
    </>
  );
}

function UltimateLobby() {
  const modes = [
    { title: "Sestava", detail: "Správa karet a chemie", href: "/ultimate-team" },
    { title: "Card Spin", detail: "Otoč kartu a rozšiř sbírku", href: "/ultimate-team" },
    { title: "FUT Match", detail: "Online zápasy", href: "/ultimate-team" },
  ];
  return (
    <section className="mt-6">
      <div className="mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// GAME MODES</p>
        <h2 className="mt-1 font-display text-2xl tracking-wider neon-text">ULTIMATE HUB</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {modes.map((mode) => (
          <Link key={mode.title} to={mode.href} className="rounded-2xl border border-border/60 bg-background/55 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40">
            <p className="font-display text-xl tracking-wider text-primary">{mode.title}</p>
            <p className="mt-2 min-h-10 text-sm text-muted-foreground">{mode.detail}</p>
            <span className="mt-5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Otevřít <ChevronRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LobbyTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="font-mono text-[9px] uppercase tracking-[0.24em]">{label}</p>
      </div>
      <p className="mt-2 font-display text-lg tracking-widest text-primary">{value}</p>
    </div>
  );
}
