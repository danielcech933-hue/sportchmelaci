import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Dices, Layers3, Spade } from "lucide-react";

const GAME_META = {
  poker: {
    title: "POKER LOBBY",
    eyebrow: "// CARD ROOM",
    description: "Samostatná pokerová herna: výběr stolu, hráči a následný vstup do partie.",
    icon: Spade,
    tone: "text-primary",
    cta: "Lobby připraveno",
  },
  roulette: {
    title: "RULETA LOBBY",
    eyebrow: "// ROULETTE FLOOR",
    description: "Samostatná ruletová herna: výběr stolu, obsazenost a následný vstup do hry.",
    icon: Dices,
    tone: "text-accent",
    cta: "Lobby připraveno",
  },
  ultimate: {
    title: "ULTIMATE LOBBY",
    eyebrow: "// FC ULTIMATE",
    description: "Sestava, karty, Card Spin a zápasy na jednom místě.",
    icon: Layers3,
    tone: "text-primary",
    cta: "Vstoupit do Ultimate",
  },
} as const;

export const Route = createFileRoute("/games/$game")({
  component: GameLobby,
});

function GameLobby() {
  const { game } = Route.useParams();
  const meta = GAME_META[game as keyof typeof GAME_META];
  if (!meta) throw notFound();
  const Icon = meta.icon;
  const isUltimate = game === "ultimate";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Lobby
      </Link>

      <section className="relative mt-5 overflow-hidden rounded-3xl border border-primary/25 bg-background/60 p-6 backdrop-blur-xl sm:p-10">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">{meta.eyebrow}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 ${meta.tone}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h1 className="font-display text-4xl tracking-[0.08em] neon-text sm:text-6xl">{meta.title}</h1>
            </div>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">{meta.description}</p>
          </div>

          {isUltimate ? (
            <Link
              to="/ultimate-team"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-display tracking-widest text-primary-foreground shadow-[0_0_28px_-10px_var(--color-primary)] transition hover:brightness-110"
            >
              {meta.cta} <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              {meta.cta}
            </span>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <LobbyTile label="Lobby" value="OPEN" />
        <LobbyTile label={game === "poker" ? "Stoly" : game === "roulette" ? "Ruletové stoly" : "Režimy"} value="Připraveno" />
        <LobbyTile label="Hráči" value="Online" />
      </section>
    </main>
  );
}

function LobbyTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-lg tracking-widest text-primary">{value}</p>
    </div>
  );
}
