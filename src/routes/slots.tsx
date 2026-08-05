import { createFileRoute } from "@tanstack/react-router";
import { Beer } from "lucide-react";
import { SlotMachine } from "@/components/slots/SlotMachine";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/slots")({
  head: () => ({
    meta: [
      { title: "Chmelovci Cup — sportovní výherní automat" },
      {
        name: "description",
        content:
          "Chmelovci Cup: prémiový sportovní slot 5×3 s free spiny, zlatými WILD míči, scatter půllitry a žebříčkem nejvyšších násobitelů.",
      },
      { property: "og:title", content: "Chmelovci Cup — sportovní výherní automat" },
      {
        property: "og:description",
        content: "Roztoč 5 válců na nočním stadionu obrostlém chmelem. Free spiny až 50× a násobitel až 8×.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlotsPage,
});

function SlotsPage() {
  const { nickname } = useAuth();

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 pb-28 sm:px-4 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-hop-gold/35 bg-black/50 p-5 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,204,68,0.25),transparent_60%)]" />
        <p className="relative inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-hop-neon/80">
          <Beer className="h-4 w-4" /> Chmelovci Cup Slot
        </p>
        <h1 className="relative mt-1 font-display text-3xl tracking-[0.12em] slot-gold-text sm:text-5xl">
          CHMELOVCI CUP
        </h1>
        <p className="relative mt-2 max-w-2xl text-sm text-foreground/75">
          Noční stadion obrostlý zářícím chmelem. 5 válců, 3 řady, 5 výherních linií, zlaté WILD míče, scatter
          půllitry a bonusová hra „Chmelové šílenství". Hraje se pouze o zábavní kredity — bez reálných peněz.
        </p>
      </header>

      <section className="mt-6">
        <SlotMachine playerName={nickname ?? "Hráč"} />
      </section>
    </main>
  );
}
