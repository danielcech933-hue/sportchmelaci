import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Clock, Phone, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/venues")({
  head: () => ({
    meta: [
      { title: "Partnerská sportoviště — Chmeloví Sportovci" },
      { name: "description", content: "Přehled partnerských sportovišť, kde hrajeme zápasy a turnaje ligy Chmeloví Sportovci." },
      { property: "og:title", content: "Partnerská sportoviště — Chmeloví Sportovci" },
      { property: "og:description", content: "Kde hrajeme: kurty, hřiště a haly našich partnerů." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VenuesPage,
});

type Venue = {
  name: string;
  city: string;
  sports: string;
  hours: string;
  phone?: string;
  note: string;
};

const VENUES: Venue[] = [
  { name: "Chmelová Aréna", city: "Praha 7", sports: "🎾 Tenis · 🏐 Volejbal · 🏆 Nohejbal", hours: "Po–Ne 8:00–22:00", phone: "+420 777 111 222", note: "Domácí hala ligy — 3 antukové kurty a scoreboard na zdi." },
  { name: "Sportpark Hopfen", city: "Brno-Židenice", sports: "⚽ Fotbal · 🎾 Padel", hours: "Po–Ne 7:00–23:00", phone: "+420 777 333 444", note: "Umělá tráva s osvětlením, padel pod střechou." },
  { name: "Pivní Pinpong Klub", city: "Plzeň", sports: "🏓 Ping pong · 🍺 Beer pong", hours: "Po–So 16:00–02:00", note: "8 stolů, turnaje každý čtvrtek." },
  { name: "Garage Darts & Foosball", city: "Ostrava", sports: "🎯 Šipky · ⚽ Stolní fotbal", hours: "Denně 15:00–01:00", note: "Elektronické terče s automatickým zápisem skóre." },
];

function VenuesPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/40 p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// PARTNER VENUES</p>
          <h1 className="mt-2 font-display text-3xl tracking-widest neon-text sm:text-5xl">SPORTOVIŠTĚ</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Kde hrajeme zápasy a turnaje. Vyber sportoviště, dohodni termín a naplánuj duel v lobby.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_var(--color-primary)]">
              Naplánovat zápas →
            </Link>
            <Link to="/tournaments" className="rounded-md border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10">
              Turnaje
            </Link>
          </div>
        </div>
      </section>

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {VENUES.map((v) => (
          <li key={v.name} className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-4 backdrop-blur transition hover:border-primary hover:shadow-[0_0_24px_-12px_var(--color-primary)]">
            <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
            <div className="relative">
              <h2 className="font-display text-2xl tracking-wide">{v.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> {v.city}
              </p>
              <p className="mt-2 text-sm text-foreground/90">{v.sports}</p>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0 text-accent" /> {v.hours}
              </p>
              {v.phone && (
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-accent" /> {v.phone}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{v.note}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-primary/20 bg-background/40 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Chceš přidat své sportoviště do sítě partnerů?{" "}
          <Link to="/support" className="inline-flex items-center gap-1 text-primary hover:underline">
            Napiš nám <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </p>
      </section>
    </main>
  );
}
