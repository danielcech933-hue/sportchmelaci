import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Trophy, Camera, Activity, Crown, Swords } from "lucide-react";
import type { ReactNode } from "react";
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
      { name: "description", content: "Tvoje sportovní identita, výsledky, odznaky, fotky, aktivita a zabezpečení účtu na jednom místě." },
      { property: "og:title", content: "Můj profil — Chmeloví Sportovci" },
      { property: "og:description", content: "Tvoje sportovní identita, výsledky, fotky a komunitní aktivita na jednom místě." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const sections = [
  { href: "#overview", label: "Přehled", icon: Sparkles },
  { href: "#achievements", label: "Výsledky", icon: Trophy },
  { href: "#photos", label: "Galerie", icon: Camera },
  { href: "#social", label: "Feed", icon: Activity },
  { href: "#security", label: "Bezpečnost", icon: ShieldCheck },
] as const;

function ProfilePage() {
  const { user, nickname } = useAuth();
  const userId = user?.id;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050a] pb-24 pt-2 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[620px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_67%)] blur-3xl" />
        <div className="absolute right-[-120px] top-[22%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.075),transparent_64%)] blur-3xl" />
        <div className="absolute bottom-[-220px] left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,.055),transparent_66%)] blur-3xl" />
      </div>
      <div className="mx-auto max-w-[1380px] px-3 sm:px-5 lg:px-7">
        <section className="relative mb-4 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(13,17,22,.97),rgba(2,5,9,.995))] shadow-[0_35px_120px_-65px_rgba(250,204,21,.58)]">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_11%_0%,rgba(250,204,21,.16),transparent_24%),radial-gradient(circle_at_88%_100%,rgba(34,211,238,.09),transparent_25%)]" />
          <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="aaa-meta text-amber-200/75">SPORTCHMELÁCI · PLAYER IDENTITY</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">PROFIL ONLINE</span></div>
              <h1 className="mt-3 font-display text-4xl font-black tracking-[.08em] text-white sm:text-6xl">MOJE <span className="gold-text">ARENA</span></h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">Tvoje sportovní identita, forma, komunita a historie výkonů. Profil je tvoje domácí základna pro všechno, co na Chmelovcích děláš.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]"><MiniSignal icon={<Crown className="h-4 w-4" />} label="IDENTITA" value={nickname || "Hráč"} /><MiniSignal icon={<Swords className="h-4 w-4" />} label="REŽIM" value={userId ? "AUTH" : "GUEST"} /></div>
          </div>
        </section>
        <nav aria-label="Profilové sekce" className="sticky top-[4rem] z-30 mb-5 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-white/8 bg-[#05080c]/78 p-1.5 shadow-[0_18px_60px_-35px_rgba(0,0,0,.95)] backdrop-blur-2xl [scrollbar-width:none]">
          {sections.map(({ href, label, icon: Icon }) => <a key={href} href={href} className="group flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 font-mono text-[9px] font-black uppercase tracking-[.16em] text-white/36 transition duration-200 hover:border-amber-300/15 hover:bg-amber-300/[.04] hover:text-amber-100"><Icon className="h-3.5 w-3.5 transition duration-200 group-hover:scale-110" />{label}</a>)}
        </nav>
        <section id="overview" className="scroll-mt-28"><ProfileView userId={userId} /></section>
        {userId ? <section id="achievements" className="scroll-mt-28"><ProfileAchievements userId={userId} /></section> : null}
        {userId ? <section id="photos" className="scroll-mt-28"><ProfileMediaGallery userId={userId} /></section> : null}
        {userId ? <section id="social" className="mt-5 scroll-mt-28"><SocialHub profileUserId={userId} /></section> : null}
        <section id="security" className="mt-5 scroll-mt-28 overflow-hidden rounded-[28px] border border-white/8 bg-black/22 shadow-[0_25px_80px_-50px_rgba(250,204,21,.25)]">
          <div className="border-b border-white/8 bg-white/[.02] px-5 py-4 sm:px-6"><div className="flex items-center gap-2 text-amber-200/65"><ShieldCheck className="h-4 w-4" /><span className="aaa-meta">ACCOUNT CORE</span></div><h2 className="mt-1 font-display text-2xl tracking-[.08em] text-white">BEZPEČNOST ÚČTU</h2></div>
          <div className="p-4 sm:p-5"><AccountSecurity /></div>
        </section>
      </div>
    </main>
  );
}
function MiniSignal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3.5 backdrop-blur-sm"><div className="flex items-center gap-2 text-cyan-200/65">{icon}<span className="aaa-meta">{label}</span></div><div className="mt-2 truncate font-display text-lg tracking-[.08em] text-white">{value}</div></div>;
}
