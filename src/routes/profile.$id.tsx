import { createFileRoute } from "@tanstack/react-router";
import { Activity, Camera, Crown, MessageSquare, ShieldCheck, Sparkles, Trophy, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { ProfileView } from "@/components/ProfileView";
import { ProfileAchievements } from "@/components/ProfileAchievements";
import { ProfileMediaGallery } from "@/components/ProfileMediaGallery";
import { SocialHub } from "@/components/SocialHub";
import { PlayerLocator } from "@/components/PlayerLocator";
import { PublicPhoneActions } from "@/components/PublicPhoneActions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({
    meta: [
      { title: "Profil hráče — Chmeloví Sportovci" },
      { name: "description", content: "Veřejný profil hráče: zápasy, statistiky, odznaky, fotky a příspěvky." },
      { property: "og:title", content: "Profil hráče — Chmeloví Sportovci" },
      { property: "og:description", content: "Veřejný profil hráče: zápasy, statistiky, odznaky, fotky a příspěvky." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicProfile,
});

const sections = [
  { href: "#player", label: "Hráč", icon: UserRound },
  { href: "#achievements", label: "Trofeje", icon: Trophy },
  { href: "#gallery", label: "Galerie", icon: Camera },
  { href: "#activity", label: "Aktivita", icon: Activity },
] as const;

function PublicProfile() {
  const { id } = Route.useParams();
  const { user, nickname } = useAuth();
  const isSelf = user?.id === id;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050a] pb-28 pt-3 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-1/2 top-0 h-[720px] w-[1050px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.10),transparent_64%)] blur-3xl" /><div className="absolute right-[-150px] top-[28%] h-[580px] w-[580px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.065),transparent_64%)] blur-3xl" /></div>
      <div className="mx-auto max-w-[1380px] px-3 sm:px-5 lg:px-7">
        <section className="relative mb-4 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(13,17,22,.97),rgba(2,5,9,.995))] shadow-[0_35px_120px_-65px_rgba(250,204,21,.55)]">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:42px_42px]" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(250,204,21,.15),transparent_22%),radial-gradient(circle_at_90%_100%,rgba(34,211,238,.08),transparent_25%)]" />
          <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8"><div><div className="flex flex-wrap items-center gap-2"><span className="aaa-meta text-amber-200/75">SPORTCHMELÁCI · PLAYER CARD</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">VEŘEJNÝ PROFIL</span></div><h1 className="mt-3 font-display text-4xl font-black tracking-[.08em] text-white sm:text-6xl">PLAYER <span className="gold-text">PROFILE</span></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">Výsledky, forma, trofeje, fotky a komunitní aktivita jednoho hráče v jednom prémiovém profilu.</p></div><div className="grid grid-cols-2 gap-2 sm:min-w-[280px]"><MiniSignal icon={<Crown className="h-4 w-4" />} label="REŽIM" value={isSelf ? "TVŮJ PROFIL" : "PLAYER"} /><MiniSignal icon={<ShieldCheck className="h-4 w-4" />} label="PŘÍSTUP" value={user ? "AUTH" : "PUBLIC"} /></div></div>
        </section>
        <nav aria-label="Sekce profilu hráče" className="sticky top-[4rem] z-30 mb-5 flex overflow-x-auto rounded-2xl border border-white/8 bg-[#05080c]/78 p-1.5 shadow-[0_18px_60px_-35px_rgba(0,0,0,.95)] backdrop-blur-2xl [scrollbar-width:none]">
          {sections.map(({ href, label, icon: Icon }) => <a key={href} href={href} className="group flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 font-mono text-[9px] font-black uppercase tracking-[.16em] text-white/36 transition hover:border-amber-300/15 hover:bg-amber-300/[.04] hover:text-amber-100"><Icon className="h-3.5 w-3.5 transition group-hover:scale-110" />{label}</a>)}
        </nav>
        <section id="player" className="scroll-mt-28"><ProfileView userId={id} /></section>
        <section id="achievements" className="scroll-mt-28"><ProfileAchievements userId={id} /></section>
        <section id="gallery" className="scroll-mt-28"><ProfileMediaGallery userId={id} /></section>
        <section id="activity" className="mt-5 scroll-mt-28"><div className="mb-3 flex items-center gap-2 text-amber-200/65"><Sparkles className="h-4 w-4" /><span className="aaa-meta">COMMUNITY SIGNAL</span></div><SocialHub profileUserId={id} /></section>
        {user && !isSelf && <section className="mt-5 rounded-[26px] border border-white/8 bg-white/[.02] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="aaa-meta text-cyan-200/65">PLAYER CONNECTION</div><h2 className="mt-1 font-display text-2xl tracking-[.08em] text-white">DALŠÍ KROK</h2><p className="mt-1 text-sm text-white/35">Spoj se s hráčem, napiš mu nebo ho sleduj přímo z profilu.</p></div><MessageSquare className="h-6 w-6 text-amber-200/45" /></div></section>}
      </div>
      {user && <PublicPhoneActions userId={id} isSelf={Boolean(isSelf)} />}
      {user && <LocatorWrapper userId={id} isSelf={Boolean(isSelf)} nickname={isSelf ? nickname : null} />}
    </main>
  );
}
function MiniSignal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3.5"><div className="flex items-center gap-2 text-cyan-200/65">{icon}<span className="aaa-meta">{label}</span></div><div className="mt-2 truncate font-display text-lg tracking-[.08em] text-white">{value}</div></div>; }
function LocatorWrapper({ userId, isSelf, nickname }: { userId: string; isSelf: boolean; nickname: string | null }) { return <PlayerLocator userId={userId} isSelf={isSelf} nickname={nickname} />; }
