import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Trophy, Camera, Activity } from "lucide-react";
import { ProfileView } from "@/components/ProfileView";
import { ProfileAchievements } from "@/components/ProfileAchievements";
import { AccountSecurity } from "@/components/AccountSecurity";
import { ProfileMediaGallery } from "@/components/ProfileMediaGallery";
import { SocialHub } from "@/components/SocialHub";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile/")({
  head: () => ({
    meta: [
      { title: "Můj profil — Chmeloví Sportovci" },
      { name: "description", content: "Tvoje zápasy, výsledky, odznaky, fotky, aktivita a zabezpečení účtu na jednom místě." },
      { property: "og:title", content: "Můj profil — Chmeloví Sportovci" },
      { property: "og:description", content: "Tvoje zápasy, výsledky, odznaky, fotky a sportovní identita." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const sections = [
  { href: "#overview", label: "Přehled", icon: Sparkles },
  { href: "#achievements", label: "Výsledky", icon: Trophy },
  { href: "#photos", label: "Fotky", icon: Camera },
  { href: "#social", label: "Aktivita", icon: Activity },
  { href: "#security", label: "Bezpečnost", icon: ShieldCheck },
] as const;

function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050a] pb-24 pt-3 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[12%] top-0 h-[520px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.10),transparent_68%)] blur-3xl" />
        <div className="absolute right-0 top-[20%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.07),transparent_66%)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1320px] px-3 sm:px-5 lg:px-7">
        <section className="relative mb-4 overflow-hidden rounded-[30px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(12,16,21,.96),rgba(2,5,9,.98))] shadow-[0_30px_100px_-55px_rgba(250,204,21,.45)]">
          <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:42px_42px] opacity-40" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(250,204,21,.13),transparent_24%),radial-gradient(circle_at_85%_100%,rgba(34,211,238,.08),transparent_24%)]" />
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="aaa-meta text-amber-200/75">SPORTCHMELÁCI · PLAYER IDENTITY</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">PROFIL ONLINE</span>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-4xl font-black tracking-[.08em] text-white sm:text-6xl">MOJE <span className="gold-text">ARENA</span></h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/38">Tvoje sportovní identita, výsledky a komunitní stopa. Všechno důležité máš na jednom dashboardu.</p>
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[.24em] text-white/20">SECURE PROFILE · {userId ? "AUTHENTICATED" : "GUEST"}</div>
            </div>
          </div>
        </section>

        <nav aria-label="Profilové sekce" className="sticky top-[4rem] z-30 mb-5 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-white/8 bg-black/60 p-1.5 shadow-[0_18px_60px_-35px_rgba(0,0,0,.9)] backdrop-blur-xl [scrollbar-width:none]">
          {sections.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="group flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 font-mono text-[9px] font-black uppercase tracking-[.16em] text-white/35 transition hover:border-amber-300/15 hover:bg-amber-300/[.04] hover:text-amber-100">
              <Icon className="h-3.5 w-3.5 transition group-hover:scale-110" />
              {label}
            </a>
          ))}
        </nav>

        <section id="overview" className="scroll-mt-28"><ProfileView userId={userId} /></section>
        {userId ? <section id="achievements" className="scroll-mt-28"><ProfileAchievements userId={userId} /></section> : null}
        {userId ? <section id="photos" className="scroll-mt-28"><ProfileMediaGallery userId={userId} /></section> : null}
        {userId ? <section id="social" className="mt-5 scroll-mt-28"><SocialHub profileUserId={userId} /></section> : null}

        <section id="security" className="mt-5 scroll-mt-28 overflow-hidden rounded-[26px] border border-white/8 bg-black/20">
          <div className="border-b border-white/8 bg-white/[.02] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-amber-200/65"><ShieldCheck className="h-4 w-4" /><span className="aaa-meta">ACCOUNT CORE</span></div>
            <h2 className="mt-1 font-display text-2xl tracking-[.08em] text-white">BEZPEČNOST ÚČTU</h2>
          </div>
          <div className="p-4 sm:p-5"><AccountSecurity /></div>
        </section>
      </div>
    </main>
  );
}
