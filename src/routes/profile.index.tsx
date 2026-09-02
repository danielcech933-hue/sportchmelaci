import { createFileRoute } from "@tanstack/react-router";
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
      { name: "description", content: "Tvoje zápasy, sázky, statistiky, odznaky, fotky a sociální feed." },
      { property: "og:title", content: "Můj profil — Chmeloví Sportovci" },
      { property: "og:description", content: "Tvoje zápasy, sázky, statistiky, odznaky, fotky a sociální feed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id;

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4">
      <nav aria-label="Profilové sekce" className="sticky top-[4rem] z-20 mb-4 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-white/8 bg-background/85 p-1.5 backdrop-blur-xl [scrollbar-width:none]">
        {[["#overview", "Přehled"], ["#achievements", "Výsledky"], ["#photos", "Fotky"], ["#social", "Aktivita"], ["#security", "Bezpečnost"]].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
            {label}
          </a>
        ))}
      </nav>
      <section id="overview" className="scroll-mt-24"><ProfileView userId={userId} /></section>
      {userId ? <section id="achievements" className="scroll-mt-24"><ProfileAchievements userId={userId} /></section> : null}
      {userId ? <section id="photos" className="scroll-mt-24"><ProfileMediaGallery userId={userId} /></section> : null}
      {userId ? <section id="social" className="mt-5 scroll-mt-24"><SocialHub profileUserId={userId} /></section> : null}
      <section id="security" className="mt-5 scroll-mt-24"><AccountSecurity /></section>
    </div>
  );
}