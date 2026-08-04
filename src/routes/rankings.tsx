import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { SPORT_LIST, type Match, type SportId } from "@/lib/matches";
import { buildLeaderboard, type LeaderRow } from "@/lib/stats";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/lib/avatars";
import { NickLink } from "@/lib/profile-links";
import { playerEmoji, rankEmoji, statEmoji } from "@/lib/emoji";
import heroImg from "@/assets/scoreboard-hero.jpg";
import goldImg from "@/assets/rank-gold.jpg";
import silverImg from "@/assets/rank-silver.jpg";
import bronzeImg from "@/assets/rank-bronze.jpg";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Scoreboard 🏆 — Chmeloví Sportovci" },
      { name: "description", content: "Neon leaderboard: solo a týmové výhry hráčů podle odehraných zápasů." },
      { property: "og:title", content: "Scoreboard 🏆 — Chmeloví Sportovci" },
      { property: "og:description", content: "Neon leaderboard: solo a týmové výhry hráčů." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RankingsPage,
});

const PODIUM = [
  { img: goldImg, label: "CHAMPION", ring: "rank-gold" },
  { img: silverImg, label: "RUNNER-UP", ring: "rank-silver" },
  { img: bronzeImg, label: "THIRD", ring: "rank-bronze" },
];

function RankingsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<{ nickname: string; avatar_path: string | null }[]>([]);
  const [tab, setTab] = useState<"solo" | "team">("solo");
  const [sport, setSport] = useState<SportId | "all">("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([
          fetchAllMatches(),
          supabase
            .from("profiles")
            .select("nickname, avatar_path")
            .then((r) => (r.data ?? []) as { nickname: string; avatar_path: string | null }[]),
        ]);
        setMatches(m);
        setProfiles(p);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  const avatarByNick = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of profiles) if (p.nickname) m.set(p.nickname.trim().toLowerCase(), p.avatar_path);
    return m;
  }, [profiles]);

  const filtered = useMemo(
    () => matches.filter((m) => sport === "all" || m.sport === sport),
    [matches, sport],
  );

  const seedNames = useMemo(() => profiles.map((p) => p.nickname).filter(Boolean), [profiles]);

  const rows: LeaderRow[] = useMemo(
    () => buildLeaderboard(filtered, tab, tab === "solo" ? seedNames : []),
    [filtered, tab, seedNames],
  );

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const chipBase = "rounded-md px-3 py-1.5 text-xs uppercase tracking-widest transition-all duration-300";
  const chipOn = "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--color-primary)]";
  const chipOff = "text-muted-foreground hover:text-foreground";

  return (
    <main className="relative mx-auto max-w-5xl px-4 py-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-56 w-full object-cover opacity-70 sm:h-72" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary/80">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Live rankings {statEmoji("elo")}
          </div>
          <h1 className="mt-2 font-display text-5xl tracking-wider neon-text sm:text-7xl">
            SCOREBOARD <span className="text-primary">🏆</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Individuální žebříček — {statEmoji("solo")} solo duely a {statEmoji("team")} ad-hoc týmové zápasy zvlášť.
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-primary/30 bg-background/40 p-1 backdrop-blur">
          <button onClick={() => setTab("solo")} className={`${chipBase} ${tab === "solo" ? chipOn : chipOff}`}>
            Solo 🧍
          </button>
          <button onClick={() => setTab("team")} className={`${chipBase} ${tab === "team" ? chipOn : chipOff}`}>
            Týmové 🤝
          </button>
        </div>
        <div className="inline-flex flex-wrap rounded-md border border-primary/30 bg-background/40 p-1 backdrop-blur">
          <button onClick={() => setSport("all")} className={`${chipBase} ${sport === "all" ? chipOn : chipOff}`}>All</button>
          {SPORT_LIST.map((s) => (
            <button
              key={s.id}
              onClick={() => setSport(s.id)}
              className={`${chipBase} ${sport === s.id ? chipOn : chipOff}`}
            >{s.emoji} {s.name}</button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        // Týmy jsou jednorázové — výhra se připisuje každému hráči v sestavě
      </p>

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      {/* PODIUM */}
      {podium.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {podium.map((r, i) => {
            const p = PODIUM[i];
            return (
              <div
                key={r.key}
                className={`relative overflow-hidden rounded-2xl border bg-background/60 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-1 ${p.ring}`}
                style={{ transform: i === 0 ? "translateY(-8px)" : undefined }}
              >
                <div className="absolute inset-0 grid-bg opacity-20" />
                <div className="relative flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-primary/40">
                    <img src={p.img} alt="" width={800} height={800} loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 text-center font-display text-2xl neon-text text-primary">
                      #{i + 1}
                    </div>
                  </div>
                  {avatarByNick.has(r.key) && <Avatar path={avatarByNick.get(r.key)} nickname={r.label} size={48} />}
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-primary/70">
                      {rankEmoji(i + 1)} {p.label}
                    </div>
                    <div className="truncate font-display text-2xl tracking-wider">
                      <span className="mr-1">{playerEmoji(r.label)}</span>
                      <NickLink nickname={r.label} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="text-primary">{r.wins}W</span>
                      <span className="text-danger">{r.losses}L</span>
                      <span>{r.played ? Math.round((r.wins / r.played) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/50 backdrop-blur">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <div className="no-scrollbar relative overflow-x-auto">
          <table className="relative w-full min-w-[420px] text-sm">
            <thead className="bg-primary/5 text-[10px] uppercase tracking-[0.25em] text-primary/70">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Hráč {statEmoji(tab)}</th>
                <th className="px-4 py-3 text-right">W</th>
                <th className="px-4 py-3 text-right">L</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Zápasy</th>
                <th className="px-4 py-3 text-right">Win %</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((r, i) => {
                const rank = i + 4;
                const pct = r.played ? Math.round((r.wins / r.played) * 100) : 0;
                return (
                  <tr key={r.key} className="border-t border-primary/10 transition-colors duration-300 hover:bg-primary/5">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{rank.toString().padStart(2, "0")}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {avatarByNick.has(r.key) && <Avatar path={avatarByNick.get(r.key)} nickname={r.label} size={28} />}
                        <span className="truncate">
                          <span className="mr-1">{playerEmoji(r.label)}</span>
                          <NickLink nickname={r.label} />
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-primary neon-text">{r.wins}</td>
                    <td className="px-4 py-3 text-right font-mono text-danger">{r.losses}</td>
                    <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">{r.played}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_8px_var(--color-primary)] transition-[width] duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="font-display text-2xl tracking-widest text-muted-foreground neon-text">NO SIGNAL</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Zatím žádné {tab === "solo" ? "solo" : "týmové"} zápasy
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
        // Naplánuj zápas v <Link to="/" className="text-primary underline">Lobby</Link>
      </p>
    </main>
  );
}
